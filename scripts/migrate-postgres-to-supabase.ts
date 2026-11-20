import { Client } from 'pg';
import { createHash } from 'node:crypto';

type ColumnInfo = {
  column_name: string;
  data_type: string;
  is_generated: string;
  is_identity: string;
};

const apply = process.argv.includes('--apply') || process.env.APPLY_MIGRATION === '1';
const verifyOnly = process.argv.includes('--verify') || process.env.VERIFY_MIGRATION === '1';
const excludedTables = new Set(['_prisma_migrations']);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe PostgreSQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function databaseIdentity(connectionString: string): string {
  const parsed = new URL(connectionString);
  // Shared Supabase pooler hosts serve multiple projects; the username carries
  // the project reference and must be part of the identity check.
  return `${parsed.username.toLowerCase()}@${parsed.hostname.toLowerCase()}:${parsed.port || '5432'}${parsed.pathname}`;
}

async function tableNames(client: Client): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map(row => row.table_name).filter(name => !excludedTables.has(name));
}

async function columns(client: Client, table: string): Promise<ColumnInfo[]> {
  const result = await client.query<ColumnInfo>(`
    SELECT column_name, data_type, is_generated, is_identity
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [table]);
  return result.rows;
}

async function rowCount(client: Client, table: string): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${quoteIdentifier(table)}`,
  );
  return Number(result.rows[0]?.count || 0);
}

async function tableDigest(client: Client, table: string, columnNames: string[]): Promise<string> {
  const selected = columnNames.map(quoteIdentifier).join(', ');
  const result = await client.query<{ row: string }>(
    `SELECT row_to_json(t)::text AS row FROM (SELECT ${selected} FROM ${quoteIdentifier(table)}) t`,
  );
  const hash = createHash('sha256');
  for (const row of result.rows.map(item => item.row).sort()) hash.update(row).update('\n');
  return hash.digest('hex');
}

async function main() {
  const sourceUrl = requiredEnv('SOURCE_DATABASE_URL');
  const targetUrl = requiredEnv('TARGET_DATABASE_URL');
  if (databaseIdentity(sourceUrl) === databaseIdentity(targetUrl)) {
    throw new Error('SOURCE_DATABASE_URL and TARGET_DATABASE_URL point to the same database.');
  }

  const source = new Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
  const target = new Client({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });
  await Promise.all([source.connect(), target.connect()]);

  try {
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const sourceTables = await tableNames(source);
    const targetTables = new Set(await tableNames(target));
    const missingTables = sourceTables.filter(table => !targetTables.has(table));
    if (missingTables.length) {
      throw new Error(`Target schema is missing tables: ${missingTables.join(', ')}`);
    }

    const plan: Array<{ table: string; count: number; columns: string[] }> = [];
    let totalRows = 0;
    for (const table of sourceTables) {
      const [sourceColumns, targetColumns, count] = await Promise.all([
        columns(source, table),
        columns(target, table),
        rowCount(source, table),
      ]);
      const targetColumnNames = new Set(targetColumns.map(column => column.column_name));
      const insertableColumns = sourceColumns
        .filter(column => column.is_generated === 'NEVER' && column.is_identity === 'NO')
        .map(column => column.column_name);
      const missingColumns = insertableColumns.filter(column => !targetColumnNames.has(column));
      if (missingColumns.length) {
        throw new Error(`${table} is missing target columns: ${missingColumns.join(', ')}`);
      }
      plan.push({ table, count, columns: insertableColumns });
      totalRows += count;
    }

    console.log(`${verifyOnly ? 'VERIFY' : apply ? 'APPLY' : 'DRY RUN'}: ${plan.length} tables and ${totalRows} rows.`);
    for (const item of plan.filter(item => item.count > 0)) {
      console.log(`${item.table}: ${item.count}`);
    }

    if (verifyOnly) {
      const mismatches: string[] = [];
      for (const item of plan) {
        const copied = await rowCount(target, item.table);
        if (copied !== item.count) {
          mismatches.push(`${item.table}: source=${item.count}, target=${copied}`);
        } else if (item.count > 0 && await tableDigest(source, item.table, item.columns) !== await tableDigest(target, item.table, item.columns)) {
          mismatches.push(`${item.table}: content checksum differs`);
        }
      }
      if (mismatches.length) throw new Error(`Migration verification failed:\n${mismatches.join('\n')}`);
      console.log(`Verification complete: all ${plan.length} tables and ${totalRows} rows match.`);
      return;
    }

    if (!apply) {
      console.log('Dry run complete. Apply Prisma migrations to Supabase, then rerun with --apply.');
      return;
    }

    const nonEmptyTargets: string[] = [];
    for (const item of plan) {
      if (await rowCount(target, item.table) > 0) nonEmptyTargets.push(item.table);
    }
    if (nonEmptyTargets.length) {
      throw new Error(`Target application tables must be empty: ${nonEmptyTargets.join(', ')}`);
    }

    await target.query('BEGIN');
    try {
      await target.query("SET LOCAL session_replication_role = 'replica'");
      for (const item of plan) {
        if (item.count === 0 || item.columns.length === 0) continue;
        const selected = item.columns.map(quoteIdentifier).join(', ');
        const rows = await source.query<Record<string, unknown>>(
          `SELECT ${selected} FROM ${quoteIdentifier(item.table)}`,
        );
        const batchSize = Math.max(1, Math.floor(50000 / item.columns.length));
        for (let offset = 0; offset < rows.rows.length; offset += batchSize) {
          const batch = rows.rows.slice(offset, offset + batchSize);
          const values: unknown[] = [];
          const tuples = batch.map((row, rowIndex) => {
            const placeholders = item.columns.map((column, columnIndex) => {
              values.push(row[column]);
              return `$${rowIndex * item.columns.length + columnIndex + 1}`;
            });
            return `(${placeholders.join(', ')})`;
          });
          await target.query(
            `INSERT INTO ${quoteIdentifier(item.table)} (${selected}) VALUES ${tuples.join(', ')}`,
            values,
          );
        }
        console.log(`Copied ${item.table}: ${rows.rowCount || 0}`);
      }
      await target.query("SET LOCAL session_replication_role = 'origin'");

      for (const item of plan) {
        const copied = await rowCount(target, item.table);
        if (copied !== item.count) {
          throw new Error(`Count mismatch for ${item.table}: source=${item.count}, target=${copied}`);
        }
        if (item.count > 0 && await tableDigest(source, item.table, item.columns) !== await tableDigest(target, item.table, item.columns)) {
          throw new Error(`Content checksum mismatch for ${item.table}`);
        }
      }
      await target.query('COMMIT');
    } catch (error) {
      await target.query('ROLLBACK');
      throw error;
    }

    console.log(`Migration complete: ${plan.length} tables and ${totalRows} rows verified.`);
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
