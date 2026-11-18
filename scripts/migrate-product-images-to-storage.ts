import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

type ImageRow = {
  id: string;
  productId: string;
  variantId: string | null;
  url: string;
  productName: string;
};

type ImageMigration = ImageRow & {
  sourcePath: string;
  storagePath: string;
  publicUrl?: string;
};

type VariantImageBackfill = {
  variantId: string;
  productId: string;
  imageId: string;
  url: string;
  productName: string;
};

const workspace = process.cwd();
const processedDirectory = path.join(workspace, 'design', 'جاهز_للمتجر_processed_webp');
const screenshotsDirectory = path.join(workspace, 'design', '07_سكرينات_مكتملة_done');
const apply = process.argv.includes('--apply');

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function sourceForUrl(url: string): Promise<string> {
  const basename = path.basename(decodeURIComponent(url));
  const processedCandidate = path.join(processedDirectory, basename);

  try {
    await fs.access(processedCandidate);
    return processedCandidate;
  } catch {
    // The newer catalog files are named by SKU in the database and by screenshot number on disk.
  }

  const screenshotNumber = basename.match(/GHAZ-NEW-(\d{3})-/)?.[1];
  if (screenshotNumber) {
    const screenshotCandidate = path.join(
      screenshotsDirectory,
      `ScreenHunter ${Number(screenshotNumber).toString().padStart(2, '0')}.png`,
    );
    await fs.access(screenshotCandidate);
    return screenshotCandidate;
  }

  throw new Error(`No source file found for ${url}`);
}

async function main() {
  const database = new Client({
    connectionString: requiredEnv('DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  });
  await database.connect();

  try {
    const result = await database.query<ImageRow>(`
      SELECT
        image.id,
        image."productId",
        image."variantId",
        image.url,
        product."nameAr" AS "productName"
      FROM "ProductImage" image
      JOIN "Product" product ON product.id = image."productId"
      WHERE image.url LIKE '/images/products/%'
      ORDER BY product."nameAr", image."order", image.id
    `);

    const migrations: ImageMigration[] = [];
    for (const row of result.rows) {
      migrations.push({
        ...row,
        sourcePath: await sourceForUrl(row.url),
        storagePath: `products/${path.basename(decodeURIComponent(row.url))}`,
      });
    }

    console.log(`Found ${migrations.length} local product-image URLs.`);
    for (const item of migrations) {
      console.log(`${item.productName}: ${item.url} <- ${path.basename(item.sourcePath)}`);
    }

    const missingVariantImages = await database.query<VariantImageBackfill>(`
      SELECT
        variant.id AS "variantId",
        variant."productId",
        image.id AS "imageId",
        image.url,
        product."nameAr" AS "productName"
      FROM "ProductVariant" variant
      JOIN "ProductImage" image ON image."variantId" = variant.id
      JOIN "Product" product ON product.id = variant."productId"
      WHERE variant."mainImage" IS NULL OR variant."mainImage" = ''
      ORDER BY product."nameAr", variant.id
    `);
    console.log(`Found ${missingVariantImages.rows.length} variants with a linked image but no mainImage.`);

    if (!apply || (migrations.length === 0 && missingVariantImages.rows.length === 0)) {
      console.log(
        apply
          ? 'Nothing to migrate.'
          : 'Dry run complete. Pass --apply to upload files and backfill variant images.',
      );
      return;
    }

    if (migrations.length > 0) {
      const supabase = createClient(
        requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
        process.env.SUPABASE_SERVICE_ROLE_KEY || requiredEnv('SUPABASE_SECRET_KEY'),
        { auth: { persistSession: false } },
      );

      for (const item of migrations) {
        const original = await fs.readFile(item.sourcePath);
        const optimized = await sharp(original).webp({ quality: 82, effort: 4 }).toBuffer();
        const { error } = await supabase.storage
          .from('product-images')
          .upload(item.storagePath, optimized, {
            contentType: 'image/webp',
            cacheControl: '31536000',
            upsert: true,
          });
        if (error) throw new Error(`Upload failed for ${item.storagePath}: ${error.message}`);

        item.publicUrl = supabase.storage.from('product-images').getPublicUrl(item.storagePath).data.publicUrl;
        const response = await fetch(item.publicUrl, { method: 'HEAD' });
        if (!response.ok) throw new Error(`Uploaded image is not reachable (${response.status}): ${item.publicUrl}`);
      }
    }

    await database.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    try {
      for (const item of migrations) {
        const updated = await database.query(
          `UPDATE "ProductImage" SET url = $1 WHERE id = $2 AND url = $3 RETURNING id`,
          [item.publicUrl, item.id, item.url],
        );
        if (updated.rowCount !== 1) throw new Error(`ProductImage changed during migration: ${item.id}`);

        if (item.variantId) {
          await database.query(
            `UPDATE "ProductVariant" SET "mainImage" = $1 WHERE id = $2`,
            [item.publicUrl, item.variantId],
          );
        }
      }

      for (const item of missingVariantImages.rows) {
        const updated = await database.query(
          `UPDATE "ProductVariant"
           SET "mainImage" = $1
           WHERE id = $2 AND ("mainImage" IS NULL OR "mainImage" = '')
           RETURNING id`,
          [item.url, item.variantId],
        );
        if (updated.rowCount !== 1) throw new Error(`ProductVariant changed during migration: ${item.variantId}`);
      }

      const grouped = new Map<string, ImageMigration[]>();
      for (const item of migrations) {
        grouped.set(item.productId, [...(grouped.get(item.productId) || []), item]);
      }
      for (const [productId, items] of grouped) {
        await database.query(
          `INSERT INTO "AuditLog"
            (id, action, "entityType", "entityId", details, "actorType", "actorNameSnapshot", category, severity, outcome, "eventKey", changes, reason)
           VALUES
            (gen_random_uuid(), 'MIGRATE_PRODUCT_IMAGES', 'Product', $1, $2, 'SYSTEM', 'Codex catalog repair', 'PRODUCTS', 'NORMAL', 'SUCCESS', 'PRODUCT_IMAGES_TO_STORAGE', $3, $4)`,
          [
            productId,
            `Moved ${items.length} product images from unavailable local URLs to public object storage.`,
            JSON.stringify(items.map(item => ({ imageId: item.id, variantId: item.variantId, before: item.url, after: item.publicUrl }))),
            'Ensure every catalog product and variant displays a reachable image on the deployed storefront.',
          ],
        );
      }


      const variantGroups = new Map<string, VariantImageBackfill[]>();
      for (const item of missingVariantImages.rows) {
        variantGroups.set(item.productId, [...(variantGroups.get(item.productId) || []), item]);
      }
      for (const [productId, items] of variantGroups) {
        await database.query(
          `INSERT INTO "AuditLog"
            (id, action, "entityType", "entityId", details, "actorType", "actorNameSnapshot", category, severity, outcome, "eventKey", changes, reason)
           VALUES
            (gen_random_uuid(), 'BACKFILL_VARIANT_IMAGES', 'Product', $1, $2, 'SYSTEM', 'Codex catalog repair', 'PRODUCTS', 'NORMAL', 'SUCCESS', 'VARIANT_MAIN_IMAGES', $3, $4)`,
          [
            productId,
            `Linked ${items.length} variants to their existing product images.`,
            JSON.stringify(items.map(item => ({ variantId: item.variantId, imageId: item.imageId, before: null, after: item.url }))),
            'Ensure selecting every catalog option uses its matching product image.',
          ],
        );
      }

      const remaining = await database.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "ProductImage" WHERE url LIKE '/images/products/%'`,
      );
      if (remaining.rows[0]?.count !== '0') {
        throw new Error(`${remaining.rows[0]?.count} local product-image URLs remain after migration.`);
      }

      const variantsWithoutImages = await database.query<{ count: string }>(`
        SELECT count(*)::text AS count
        FROM "ProductVariant" variant
        JOIN "ProductImage" image ON image."variantId" = variant.id
        WHERE variant."mainImage" IS NULL OR variant."mainImage" = ''
      `);
      if (variantsWithoutImages.rows[0]?.count !== '0') {
        throw new Error(`${variantsWithoutImages.rows[0]?.count} linked variants still have no mainImage.`);
      }

      await database.query('COMMIT');
      console.log(
        `Migrated ${migrations.length} image URLs and backfilled ${missingVariantImages.rows.length} variant images.`,
      );
    } catch (error) {
      await database.query('ROLLBACK');
      throw error;
    }
  } finally {
    await database.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
