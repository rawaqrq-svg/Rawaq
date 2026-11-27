import fs from 'node:fs/promises';
import { Client } from 'pg';
import { BackupConfig } from './config';

export interface NeonRestoreResult {
  schemaName: string;
  restoredTablesCount: number;
  restoredRowsCount: number;
  tablesSummary: Record<string, number>;
  success: boolean;
  error?: string;
}

export async function restoreToNeon(
  config: BackupConfig,
  dumpSqlPath: string,
  backupId: string,
): Promise<NeonRestoreResult> {
  // Sanitize schema name: replace hyphens with underscores
  const cleanId = backupId.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const schemaName = `backup_${cleanId}`;

  const client = new Client({
    connectionString: config.neonDatabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    // 1. Ensure public metadata table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.rawaq_backups_metadata (
        id SERIAL PRIMARY KEY,
        backup_id VARCHAR(100) UNIQUE NOT NULL,
        schema_name VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        record_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
        archive_size_bytes BIGINT,
        checksum_sha256 VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        verified_at TIMESTAMPTZ,
        pruned_at TIMESTAMPTZ
      );
    `);

    // 2. Create isolated schema
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    await client.query(`CREATE SCHEMA "${schemaName}";`);

    // 3. Set search path so all dump statements land inside the backup schema
    await client.query(`SET search_path = "${schemaName}", public;`);

    // 4. Read and execute dump.sql
    const dumpSql = await fs.readFile(dumpSqlPath, 'utf-8');
    await client.query(dumpSql);

    // 5. Verify restored tables and count rows inside the new schema
    const tablesQuery = await client.query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `, [schemaName]);

    const tablesSummary: Record<string, number> = {};
    let totalRows = 0;

    for (const row of tablesQuery.rows) {
      const countRes = await client.query(`SELECT count(*)::int AS count FROM "${schemaName}"."${row.table_name}"`);
      const count = countRes.rows[0].count;
      tablesSummary[row.table_name] = count;
      totalRows += count;
    }

    // 6. Record in metadata
    await client.query(`
      INSERT INTO public.rawaq_backups_metadata (backup_id, schema_name, status, record_counts, created_at)
      VALUES ($1, $2, 'RESTORED', $3, NOW())
      ON CONFLICT (backup_id) 
      DO UPDATE SET status = 'RESTORED', schema_name = $2, record_counts = $3;
    `, [backupId, schemaName, JSON.stringify(tablesSummary)]);

    return {
      schemaName,
      restoredTablesCount: tablesQuery.rows.length,
      restoredRowsCount: totalRows,
      tablesSummary,
      success: true,
    };
  } catch (err: any) {
    console.error(`[Restore To Neon] Error restoring backup ${backupId}:`, err);
    return {
      schemaName,
      restoredTablesCount: 0,
      restoredRowsCount: 0,
      tablesSummary: {},
      success: false,
      error: err.message,
    };
  } finally {
    await client.end();
  }
}
