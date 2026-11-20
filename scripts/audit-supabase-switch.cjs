const { Client } = require('pg');

async function inspect(label, connectionString) {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
    const counts = {};
    for (const { table_name: name } of tables.rows) {
      if (!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(name)) throw new Error('Unexpected table identifier');
      counts[name] = Number((await client.query(`SELECT count(*)::int AS count FROM "${name}"`)).rows[0].count);
    }
    const buckets = await client.query('SELECT id, name, public FROM storage.buckets ORDER BY id');
    const objects = await client.query('SELECT bucket_id, count(*)::int AS count, coalesce(sum((metadata->>\'size\')::bigint),0)::text AS bytes FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id');
    console.log(JSON.stringify({ label, project: new URL(connectionString).username, tableCount: tables.rowCount, populatedTables: Object.fromEntries(Object.entries(counts).filter(([,count]) => count > 0)), buckets: buckets.rows, objects: objects.rows }, null, 2));
  } finally { await client.end(); }
}

async function main() {
  await inspect('source', process.env.DATABASE_URL);
  await inspect('target', process.env.TARGET_DATABASE_URL);
}
main().catch(error => { console.error({ code: error.code, message: error.message }); process.exitCode = 1; });
