import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '../src/lib/db';
import { catalogBatch78194, catalogVariantCount, type CatalogProduct } from './catalog-batch-78-194';

const apply = process.argv.includes('--apply');
const hideLegacy = process.argv.includes('--hide-legacy');
const imageDiskRoot = path.join(process.cwd(), 'public');

const brandConfig = {
  'العروسة': { slug: 'al-arousa', nameAr: 'العروسة', nameEn: 'Al Arousa' },
  COSMO: { slug: 'cosmo', nameAr: 'كوزمو', nameEn: 'COSMO' },
} as const;

const legacyFamilyTerms: Record<string, [string, string]> = {
  'alarousa-bikini-scrub': ['مقشر البكيني', 'Bikini Scrub'],
  'alarousa-body-butter': ['زبدة الجسم', 'Body Butter'],
  'alarousa-body-oil': ['زيت الجسم', 'Body Oil'],
  'alarousa-body-scrub': ['مقشر الجسم', 'Body Scrub'],
  'alarousa-body-soap': ['صابون الجسم', 'Body Soap'],
  'alarousa-body-splash': ['بودي سبلاش', 'Body Splash'],
  'alarousa-brush-face-wash': ['غسول وجه', 'Face Wash'],
  'alarousa-feminine-wash': ['غسول نسائي', 'Feminine Wash'],
  'alarousa-pheromone-musk': ['مسك', 'Musk'],
  'cosmo-body-lotion': ['لوشن الجسم', 'Body Lotion'],
  'cosmo-face-mask': ['ماسك الوجه', 'Face Mask'],
  'cosmo-foaming-face-wash': ['غسول وجه رغوي', 'Foaming Face Wash'],
  'cosmo-salt-body-scrub': ['مقشر الجسم الملحي', 'Salt Body Scrub'],
  'cosmo-shea-sugar-scrub': ['مقشر السكر', 'Sugar Scrub'],
  'deep-love-body-oil': ['زيت عطري', 'Deep Love'],
};

function variantSku(product: CatalogProduct, key: string): string {
  return `${product.sku}-${key.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`.slice(0, 120);
}

function validateManifest(): void {
  if (catalogVariantCount !== 99) {
    throw new Error(`Expected 99 variants, received ${catalogVariantCount}.`);
  }
  const slugs = new Set<string>();
  const skus = new Set<string>();
  const images = new Set<string>();
  for (const product of catalogBatch78194) {
    if (slugs.has(product.slug)) throw new Error(`Duplicate product slug: ${product.slug}`);
    slugs.add(product.slug);
    for (const variant of product.variants) {
      const sku = variantSku(product, variant.key);
      if (skus.has(sku)) throw new Error(`Duplicate variant SKU: ${sku}`);
      if (images.has(variant.image)) throw new Error(`Duplicate image assignment: ${variant.image}`);
      skus.add(sku);
      images.add(variant.image);
      const diskPath = path.join(imageDiskRoot, variant.image.replace(/^\//, ''));
      if (!fs.existsSync(diskPath)) throw new Error(`Missing image: ${diskPath}`);
    }
  }
}

async function findLegacyCandidates(product: CatalogProduct, brandId: string) {
  const familyTerms = legacyFamilyTerms[product.slug];
  if (!familyTerms) return [];
  const variantTerms = product.variants.flatMap((variant) => [variant.nameAr, variant.nameEn]);
  return prisma.product.findMany({
    where: {
      brandId,
      slug: { not: product.slug },
      OR: [
        { nameAr: { contains: familyTerms[0], mode: 'insensitive' } },
        { nameEn: { contains: familyTerms[1], mode: 'insensitive' } },
      ],
      AND: [{
        OR: variantTerms.map((term) => ({ nameAr: { contains: term, mode: 'insensitive' as const } }))
          .concat(variantTerms.map((term) => ({ nameEn: { contains: term, mode: 'insensitive' as const } }))),
      }],
    },
    select: { id: true, slug: true, nameAr: true, nameEn: true, isVisible: true },
  });
}

async function main() {
  validateManifest();
  const reviewItems = catalogBatch78194.flatMap((product) =>
    product.variants.filter((variant) => variant.needsReview).map((variant) => `${product.slug}/${variant.key}`),
  );
  if (apply && reviewItems.length > 0) {
    throw new Error(`Refusing DB write: unresolved review items: ${reviewItems.join(', ')}`);
  }

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${catalogBatch78194.length} parent products, ${catalogVariantCount} variants.`);
  if (reviewItems.length) console.log(`Needs review: ${reviewItems.join(', ')}`);

  const brandIds = new Map<string, string>();
  for (const [key, config] of Object.entries(brandConfig)) {
    const existing = await prisma.brand.findUnique({ where: { slug: config.slug } });
    if (!existing && !apply) {
      console.log(`[plan] create brand ${config.nameEn}`);
      continue;
    }
    const brand = apply
      ? await prisma.brand.upsert({
          where: { slug: config.slug },
          update: { nameAr: config.nameAr, nameEn: config.nameEn, isVisible: true },
          create: { ...config, isVisible: true },
        })
      : existing!;
    brandIds.set(key, brand.id);
  }

  for (const product of catalogBatch78194) {
    let category = await prisma.category.findUnique({ where: { slug: product.categorySlug } });
    if (!category && apply) {
      category = await prisma.category.create({ data: { slug: product.categorySlug, name: product.category, isVisible: true } });
    }
    if (!category) {
      console.log(`[plan] ${product.slug}: create category ${product.category} and upsert ${product.variants.length} variants`);
      continue;
    }
    const brandId = brandIds.get(product.brand);
    if (!brandId) {
      console.log(`[plan] ${product.slug}: brand ${product.brand} will be created before import`);
      continue;
    }

    const legacy = await findLegacyCandidates(product, brandId);
    if (legacy.length) {
      console.log(`[legacy] ${product.slug}: ${legacy.map((item) => `${item.slug} (${item.nameAr})`).join(', ')}`);
    }
    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      const record = await tx.product.upsert({
        where: { slug: product.slug },
        update: {
          nameAr: product.nameAr,
          nameEn: product.nameEn,
          shortDescription: product.shortDescription,
          categoryId: category.id,
          brandId,
          isVisible: true,
          needsReview: false,
          reviewReasons: null,
          stockStatus: 'UNVERIFIED',
        },
        create: {
          slug: product.slug,
          sku: product.sku,
          nameAr: product.nameAr,
          nameEn: product.nameEn,
          shortDescription: product.shortDescription,
          categoryId: category.id,
          brandId,
          isVisible: true,
          stockStatus: 'UNVERIFIED',
          notesStatus: 'VERIFIED',
        },
      });

      await tx.productImage.deleteMany({
        where: {
          productId: record.id,
          OR: [
            { url: { startsWith: '/images/products/batch-78-194/' } },
            { url: { startsWith: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/products/` } },
          ],
        },
      });

      for (const [index, variant] of product.variants.entries()) {
        const sku = variantSku(product, variant.key);
        const savedVariant = await tx.productVariant.upsert({
          where: { sku },
          update: {
            productId: record.id,
            name: variant.nameAr,
            size: variant.size || 'عبوة واحدة',
            price: variant.priceFils,
            mainImage: variant.image,
            isActive: true,
          },
          create: {
            productId: record.id,
            sku,
            name: variant.nameAr,
            size: variant.size || 'عبوة واحدة',
            price: variant.priceFils,
            stock: 0,
            mainImage: variant.image,
            isActive: true,
            inventorySource: 'INTERNAL',
          },
        });
        await tx.productImage.create({
          data: {
            productId: record.id,
            variantId: savedVariant.id,
            url: variant.image,
            alt: `${product.nameAr} - ${variant.nameAr}`,
            type: 'PRIMARY',
            isMain: index === 0,
            order: index,
          },
        });
      }
      if (hideLegacy && legacy.length) {
        await tx.product.updateMany({
          where: { id: { in: legacy.map((item) => item.id) } },
          data: {
            isVisible: false,
            needsReview: true,
            reviewReasons: `تم دمج هذا المنتج كخيار تحت ${product.slug}`,
          },
        });
      }
    });
    console.log(`[done] ${product.slug}: ${product.variants.length} variants${hideLegacy ? `, hidden legacy ${legacy.length}` : ''}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
