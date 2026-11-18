import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const imageNames: Record<string, string> = {
  '24': 'askim-body-splash-moon-250ml.webp',
  '25': 'askim-body-splash-sweet-250ml.webp',
  '26': 'askim-body-splash-classic-250ml.webp',
  '27': 'askim-body-splash-fresh-250ml.webp',
  '28': 'askim-body-lotion-moon-250ml.webp',
  '29': 'askim-body-lotion-rose-250ml.webp',
  '30': 'askim-body-lotion-sweet-250ml.webp',
  '31': 'askim-body-lotion-classic-250ml.webp',
  '32': 'askim-body-lotion-fresh-250ml.webp',
  '33': 'askim-body-butter-rose-250g.webp',
  '34': 'askim-body-butter-sweet-250g.webp',
  '35': 'askim-body-butter-classic-250g.webp',
  '36': 'askim-body-butter-moon-250g.webp',
  '37': 'askim-body-butter-fresh-250g.webp',
  '38': 'askim-shower-gel-fresh.webp',
  '39': 'askim-shower-gel-sweet.webp',
  '40': 'askim-shower-gel-moon.webp',
  '41': 'askim-shower-gel-rose.webp',
  '42': 'askim-shower-gel-classic.webp',
  '43': 'askim-hair-mist-rose-100ml.webp',
  '44': 'askim-hair-mist-classic-100ml.webp',
  '45': 'askim-hair-mist-sweet-100ml.webp',
  '46': 'askim-hair-mist-moon-100ml.webp',
  '47': 'askim-hair-mist-fresh-100ml.webp',
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  const database = new Client({ connectionString: requiredEnv('DATABASE_URL'), ssl: { rejectUnauthorized: false } });
  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    process.env.SUPABASE_SERVICE_ROLE_KEY || requiredEnv('SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false } },
  );
  const sourceDirectory = path.join(process.cwd(), 'design', 'جاهز_للمتجر_processed_webp');
  await database.connect();

  try {
    const rows = await database.query<{ id: string; variantId: string | null; url: string; productId: string }>(
      `SELECT id, "variantId", url, "productId" FROM "ProductImage" WHERE url LIKE '%ScreenHunter%'`,
    );
    if (rows.rows.length === 0) {
      console.log('No ScreenHunter image references remain.');
      return;
    }

    await database.query('BEGIN');
    for (const row of rows.rows) {
      const match = decodeURIComponent(row.url).match(/ScreenHunter\s+(\d+)/i);
      const fileName = match ? imageNames[match[1]] : undefined;
      if (!fileName) throw new Error(`No designed filename mapping for ${row.url}`);
      const source = path.join(sourceDirectory, `ScreenHunter ${match![1]}.webp`);
      const bytes = await fs.readFile(source);
      const storagePath = `products/${fileName}`;
      const upload = await supabase.storage.from('product-images').upload(storagePath, bytes, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });
      if (upload.error) throw upload.error;
      const publicUrl = supabase.storage.from('product-images').getPublicUrl(storagePath).data.publicUrl;
      const updated = await database.query(
        `UPDATE "ProductImage" SET url = $1 WHERE id = $2 AND url = $3 RETURNING "variantId"`,
        [publicUrl, row.id, row.url],
      );
      if (updated.rowCount !== 1) throw new Error(`Image changed while repairing ${row.id}`);
      if (row.variantId) {
        await database.query(
          `UPDATE "ProductVariant" SET "mainImage" = $1 WHERE id = $2 AND "mainImage" = $3`,
          [publicUrl, row.variantId, row.url],
        );
      }
      console.log(`${row.url} -> ${publicUrl}`);
    }
    await database.query('COMMIT');
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  } finally {
    await database.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
