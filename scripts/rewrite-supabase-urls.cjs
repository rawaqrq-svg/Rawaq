const { Client } = require('pg');

const apply = process.argv.includes('--apply');
const oldHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
const newHost = new URL(process.env.TARGET_SUPABASE_URL).host;
const quote = value => `"${value.replaceAll('"', '""')}"`;

async function main() {
  const db = new Client({ connectionString: process.env.TARGET_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await db.connect();
    await db.query('BEGIN');
    const columns = await db.query(`SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name NOT IN ('AuditLog', 'FulfillmentAuditLog', 'OrderStatusHistory')
        AND data_type IN ('text','character varying','json','jsonb')
      ORDER BY table_name, ordinal_position`);
    let affected = 0;
    for (const column of columns.rows) {
      const table = quote(column.table_name), field = quote(column.column_name);
      const count = await db.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${field}::text LIKE $1`, [`%${oldHost}%`]);
      if (!count.rows[0].count) continue;
      console.log(`${column.table_name}.${column.column_name}: ${count.rows[0].count}`);
      affected += count.rows[0].count;
      if (apply) {
        const cast = column.data_type === 'jsonb' ? '::jsonb' : column.data_type === 'json' ? '::json' : '';
        await db.query(`UPDATE ${table} SET ${field} = replace(${field}::text, $1, $2)${cast} WHERE ${field}::text LIKE $3`, [oldHost, newHost, `%${oldHost}%`]);
      }
    }
    await db.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(`${apply ? 'Updated' : 'Found'} ${affected} old-project references.`);
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message || error.code); process.exitCode = 1; });
