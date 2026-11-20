const { Client } = require('pg');

// IDs are the existing public shop links. Products keep their categoryId.
const parentByChild = {
  '0e71b49f-9b56-4525-8d63-a28fd1aae82e': '060016ae-b800-4a3c-b168-233f30a272cd', // intimate care -> body care
  'a08983da-4f9b-446e-a2bd-57dd3259910c': '926accc7-c528-44a2-94f1-1dd7414cff2b', // face care -> skincare
  'b94f711c-0452-437f-9a7a-838eee865f2d': '6c2337b7-fb6b-48a0-a3cb-885e0dbe3b82', // musk -> perfume
  '84c3b7f8-c829-4a8b-b713-ca59b2815214': '060016ae-b800-4a3c-b168-233f30a272cd', // body oil
  '6df1ef8a-b816-40b6-92c8-436abf491308': 'a08983da-4f9b-446e-a2bd-57dd3259910c', // face wash
  '631f5c56-da62-4849-897d-1349a1caeeae': 'a08983da-4f9b-446e-a2bd-57dd3259910c', // face masks
  '6b79e023-3117-4405-9c61-098e811a9167': '060016ae-b800-4a3c-b168-233f30a272cd', // body mist
  '8815043b-94b4-490b-916d-84a25443349d': '060016ae-b800-4a3c-b168-233f30a272cd', // body scrubs
};

async function main() {
  const apply = process.argv.includes('--apply');
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query('BEGIN');
    const ids = [...new Set([...Object.keys(parentByChild), ...Object.values(parentByChild)])];
    const result = await client.query('SELECT id, name, "parentId" FROM "Category" WHERE id = ANY($1::text[]) FOR UPDATE', [ids]);
    const byId = new Map(result.rows.map(row => [row.id, row]));
    const missing = ids.filter(id => !byId.has(id));
    if (missing.length) throw new Error(`Required category IDs missing: ${missing.join(', ')}`);
    const changes = Object.entries(parentByChild).filter(([child, parent]) => byId.get(child).parentId !== parent);
    for (const [child, parent] of changes) {
      console.log(`${byId.get(child).name} -> ${byId.get(parent).name}`);
      if (apply) await client.query('UPDATE "Category" SET "parentId" = $1 WHERE id = $2', [parent, child]);
    }
    if (apply) {
      const cycles = await client.query(`WITH RECURSIVE chain AS (
        SELECT id, "parentId", ARRAY[id] AS path, false AS cycle FROM "Category"
        UNION ALL
        SELECT chain.id, parent."parentId", path || parent.id, parent.id = ANY(path)
        FROM chain JOIN "Category" parent ON parent.id = chain."parentId" WHERE NOT chain.cycle
      ) SELECT id FROM chain WHERE cycle LIMIT 1`);
      if (cycles.rowCount) throw new Error('Category cycle detected; rolling back');
      await client.query('COMMIT');
    } else await client.query('ROLLBACK');
    console.log(`${apply ? 'Applied' : 'Previewed'} ${changes.length} category links; products were not modified.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}

main().catch(error => { console.error(error.message || error.code); process.exitCode = 1; });
