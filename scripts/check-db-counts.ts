import 'dotenv/config';
import { Client } from 'pg';
async function main() {
  const c = new Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  for (const t of ['Product', 'ProductVariant', 'ProductImage', 'SupplierOffer', 'Supplier', 'Category', 'Brand']) {
    const x = await c.query(`SELECT count(*)::int AS n FROM "${t}"`);
    console.log(`${t}=${x.rows[0].n}`);
  }
  await c.end();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
