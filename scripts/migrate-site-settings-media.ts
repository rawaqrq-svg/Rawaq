import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const apply = process.argv.includes('--apply') || process.env.APPLY_MIGRATION === '1';
const localMediaPattern = /\/(?:images|uploads)\/[^"'\\\s]+/g;

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
    const settings = await database.query<{ key: string; value: string }>(`
      SELECT key, value FROM "SiteSettings"
      WHERE value LIKE '%/images/%' OR value LIKE '%/uploads/%'
      ORDER BY key
    `);
    const localUrls = [...new Set(settings.rows.flatMap(row => row.value.match(localMediaPattern) || []))];
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${localUrls.length} local SiteSettings media files.`);
    if (!apply || localUrls.length === 0) return;

    const supabase = createClient(
      requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      process.env.SUPABASE_SERVICE_ROLE_KEY || requiredEnv('SUPABASE_SECRET_KEY'),
      { auth: { persistSession: false } },
    );
    const replacements = new Map<string, string>();
    for (const localUrl of localUrls) {
      const source = path.join(process.cwd(), 'public', decodeURIComponent(localUrl).replace(/^\/+/, ''));
      const sourceBytes = await fs.readFile(source);
      const optimized = await sharp(sourceBytes, { animated: path.extname(source).toLowerCase() === '.gif' })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      const baseName = path.basename(source, path.extname(source)).replace(/[^a-zA-Z0-9_-]/g, '_');
      const storagePath = `site-settings/${baseName}.webp`;
      const upload = await supabase.storage.from('uploads').upload(storagePath, optimized, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });
      if (upload.error) throw new Error(`Upload failed for ${localUrl}: ${upload.error.message}`);
      const publicUrl = supabase.storage.from('uploads').getPublicUrl(storagePath).data.publicUrl;
      const response = await fetch(publicUrl, { method: 'HEAD' });
      if (!response.ok) throw new Error(`Uploaded SiteSettings image is not reachable (${response.status})`);
      replacements.set(localUrl, publicUrl);
    }

    await database.query('BEGIN');
    try {
      for (const setting of settings.rows) {
        let updatedValue = setting.value;
        for (const [before, after] of replacements) updatedValue = updatedValue.split(before).join(after);
        if (updatedValue === setting.value) continue;
        const changed = await database.query(
          `UPDATE "SiteSettings" SET value = $1 WHERE key = $2 AND value = $3 RETURNING key`,
          [updatedValue, setting.key, setting.value],
        );
        if (changed.rowCount !== 1) throw new Error(`SiteSettings changed during migration: ${setting.key}`);
      }
      await database.query('COMMIT');
    } catch (error) {
      await database.query('ROLLBACK');
      throw error;
    }
    console.log(`Migrated ${localUrls.length} SiteSettings media files to Supabase Storage.`);
  } finally {
    await database.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
