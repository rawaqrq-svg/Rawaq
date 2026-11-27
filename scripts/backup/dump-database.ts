import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { BackupConfig } from './config';

export interface DatabaseDumpResult {
  dumpSqlPath: string;
  summaryPath: string;
  tableCount: number;
  totalRows: number;
  dumpSizeBytes: number;
  tablesSummary: Record<string, number>;
}

/**
 * Escapes values safely for raw SQL INSERT statements
 */
function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value.toString();
    return 'NULL';
  }
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Buffer.isBuffer(value)) return `E'\\\\x${value.toString('hex')}'`;
  if (typeof value === 'object') {
    const jsonStr = JSON.stringify(value);
    return `'${jsonStr.replace(/'/g, "''")}'::jsonb`;
  }
  // String escaping
  const str = String(value);
  return `'${str.replace(/'/g, "''")}'`;
}

export async function dumpDatabase(
  config: BackupConfig,
  outputDir: string,
): Promise<DatabaseDumpResult> {
  const databaseDir = path.join(outputDir, 'database');
  await fs.mkdir(databaseDir, { recursive: true });

  const client = new Client({
    connectionString: config.supabaseDirectUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    // 1. Get all base tables in the 'public' schema
    const tablesQuery = await client.query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE '_prisma%'
      ORDER BY table_name ASC;
    `);

    const tableNames = tablesQuery.rows.map((r) => r.table_name);
    const tablesSummary: Record<string, number> = {};
    let totalRows = 0;

    const sqlChunks: string[] = [
      `-- RAWAQ AUTOMATED BACKUP DATABASE DUMP`,
      `-- Generated at: ${new Date().toISOString()}`,
      `-- Target: Supabase to Neon Backup`,
      ``,
      `SET statement_timeout = 0;`,
      `SET lock_timeout = 0;`,
      `SET idle_in_transaction_session_timeout = 0;`,
      `SET client_encoding = 'UTF8';`,
      `SET standard_conforming_strings = on;`,
      `SET check_function_bodies = false;`,
      `SET xmloption = content;`,
      `SET client_min_messages = warning;`,
      `SET row_security = off;`,
      ``,
    ];

    // 2. Extract table schemas and data
    for (const table of tableNames) {
      // Get column metadata
      const columnsQuery = await client.query<{
        column_name: string;
        data_type: string;
        udt_name: string;
        is_nullable: string;
        column_default: string | null;
      }>(`
        SELECT 
          column_name, 
          data_type, 
          udt_name, 
          is_nullable, 
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position ASC;
      `, [table]);

      const columns = columnsQuery.rows;
      if (columns.length === 0) continue;

      // Build CREATE TABLE statement
      const columnDefs = columns.map((col) => {
        let def = `  "${col.column_name}" `;
        // Handle special postgres types
        if (col.data_type === 'USER-DEFINED') {
          def += `TEXT`;
        } else if (col.data_type === 'ARRAY') {
          def += `${col.udt_name.replace(/^_/, '')}[]`;
        } else {
          def += col.udt_name.toUpperCase();
        }

        if (col.column_default && !col.column_default.includes('nextval')) {
          def += ` DEFAULT ${col.column_default}`;
        }
        if (col.is_nullable === 'NO') {
          def += ` NOT NULL`;
        }
        return def;
      });

      sqlChunks.push(`CREATE TABLE IF NOT EXISTS "${table}" (`);
      sqlChunks.push(columnDefs.join(',\n'));
      sqlChunks.push(`);\n`);

      // Extract row data
      const dataQuery = await client.query(`SELECT * FROM "${table}"`);
      const rowCount = dataQuery.rows.length;
      tablesSummary[table] = rowCount;
      totalRows += rowCount;

      if (rowCount > 0) {
        const colList = columns.map((c) => `"${c.column_name}"`).join(', ');
        const batchSize = 100;

        for (let i = 0; i < rowCount; i += batchSize) {
          const batch = dataQuery.rows.slice(i, i + batchSize);
          const valueRows = batch.map((row) => {
            const vals = columns.map((col) => escapeSqlValue(row[col.column_name]));
            return `(${vals.join(', ')})`;
          });

          sqlChunks.push(`INSERT INTO "${table}" (${colList}) VALUES\n${valueRows.join(',\n')};\n`);
        }
      }
    }

    // Add Primary Keys & Unique Constraints
    const pkQuery = await client.query<{
      table_name: string;
      constraint_name: string;
      column_name: string;
    }>(`
      SELECT 
        tc.table_name, 
        tc.constraint_name, 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name 
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' 
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY tc.table_name, kcu.ordinal_position;
    `);

    const pkMap: Record<string, string[]> = {};
    for (const r of pkQuery.rows) {
      if (!pkMap[r.table_name]) pkMap[r.table_name] = [];
      pkMap[r.table_name].push(`"${r.column_name}"`);
    }

    for (const [tName, cols] of Object.entries(pkMap)) {
      if (tableNames.includes(tName)) {
        sqlChunks.push(
          `DO $$ BEGIN `,
          `  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${tName}_pkey') THEN `,
          `    ALTER TABLE "${tName}" ADD PRIMARY KEY (${cols.join(', ')}); `,
          `  END IF; `,
          `END $$;\n`,
        );
      }
    }

    const fullSql = sqlChunks.join('\n');
    const dumpSqlPath = path.join(databaseDir, 'dump.sql');
    const summaryPath = path.join(databaseDir, 'tables-summary.json');

    await fs.writeFile(dumpSqlPath, fullSql, 'utf-8');
    await fs.writeFile(
      summaryPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          totalTables: tableNames.length,
          totalRows,
          tables: tablesSummary,
        },
        null,
        2,
      ),
      'utf-8',
    );

    const stats = await fs.stat(dumpSqlPath);

    return {
      dumpSqlPath,
      summaryPath,
      tableCount: tableNames.length,
      totalRows,
      dumpSizeBytes: stats.size,
      tablesSummary,
    };
  } finally {
    await client.end();
  }
}
