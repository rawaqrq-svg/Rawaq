const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const database = await client.query('SELECT pg_database_size(current_database())::bigint AS size');
    const storage = await client.query("SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)::bigint AS size FROM storage.objects WHERE metadata->>'size' ~ '^[0-9]+$'");
    const tables = await client.query("SELECT COUNT(*)::bigint AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
    console.log(JSON.stringify({ databaseBytes: String(database.rows[0].size), storageBytes: String(storage.rows[0].size), publicTables: String(tables.rows[0].count) }));
  } finally { await client.end(); }
}

main().catch(error => { console.error(error.message || error.code); process.exitCode = 1; });
