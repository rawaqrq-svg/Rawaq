import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const apply = process.argv.includes('--apply') || process.env.APPLY_MIGRATION === '1';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const database = new Client({
    connectionString: requiredEnv('DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  });
  await database.connect();

  try {
    const result = await database.query<{ id: string; slug: string; imagePath: string }>(`
      SELECT id, slug, "imagePath"
      FROM "Category"
      WHERE "imagePath" LIKE '/images/%' OR "imagePath" LIKE '/uploads/%'
      ORDER BY slug
    `);
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${result.rowCount || 0} local category images.`);
    if (!apply || result.rows.length === 0) return;

    const supabase = createClient(
      requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      process.env.SUPABASE_SERVICE_ROLE_KEY || requiredEnv('SUPABASE_SECRET_KEY'),
      { auth: { persistSession: false } },
    );

    const updates: Array<{ id: string; before: string; after: string }> = [];
    for (const row of result.rows) {
      const source = path.join(process.cwd(), 'public', decodeURIComponent(row.imagePath).replace(/^\/+/, ''));
      const sourceBytes = await fs.readFile(source);
      const optimized = await sharp(sourceBytes).webp({ quality: 82, effort: 4 }).toBuffer();
      const storagePath = `categories/${row.slug}.webp`;
      const upload = await supabase.storage.from('product-images').upload(storagePath, optimized, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });
      if (upload.error) throw new Error(`Upload failed for ${row.slug}: ${upload.error.message}`);
      const publicUrl = supabase.storage.from('product-images').getPublicUrl(storagePath).data.publicUrl;
      const response = await fetch(publicUrl, { method: 'HEAD' });
      if (!response.ok) throw new Error(`Uploaded category image is not reachable (${response.status}): ${row.slug}`);
      updates.push({ id: row.id, before: row.imagePath, after: publicUrl });
    }

    await database.query('BEGIN');
    try {
      for (const update of updates) {
        const changed = await database.query(
          `UPDATE "Category" SET "imagePath" = $1 WHERE id = $2 AND "imagePath" = $3 RETURNING id`,
          [update.after, update.id, update.before],
        );
        if (changed.rowCount !== 1) throw new Error(`Category changed during migration: ${update.id}`);
      }
      await database.query('COMMIT');
    } catch (error) {
      await database.query('ROLLBACK');
      throw error;
    }
    console.log(`Migrated ${updates.length} category images to Supabase Storage.`);
  } finally {
    await database.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
