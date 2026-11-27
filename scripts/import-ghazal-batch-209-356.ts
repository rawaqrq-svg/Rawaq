import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { prisma } from '../src/lib/db';

type ManifestVariant = {
  nameAr: string;
  nameEn: string;
  optionType: string;
  size: string;
  priceFils: number;
  costFils: number;
  imagePath: string;
  imageName: string;
  sku: string;
  order: number;
};

type ManifestProduct = {
  reference: string;
  slug: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  brand: string;
  category: string;
  categoryMain: string;
  shortDescription: string;
  longDescription: string;
  size?: string;
  optionType: string;
  variants: ManifestVariant[];
};

const apply = process.argv.includes('--apply');
const manifestPath = path.join(process.cwd(), 'scripts', 'ghazal-batch-209-356.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ManifestProduct[];
const supplierName = 'محل غزل للمكياجات';

const brandSlugs: Record<string, string> = {
  Agrado: 'agrado',
  'Boutique Cosmetics': 'boutique-cosmetics',
  'Confetti London': 'confetti-london',
  Dove: 'dove',
  'Elegance Plus': 'elegance-plus',
  Emotion: 'emotion',
  Emper: 'emper',
  Enchanteur: 'enchanteur',
  FOGG: 'fogg',
  Glysolid: 'glysolid',
  HiGeen: 'higeen',
  MBC: 'mbc',
  'Old Spice': 'old-spice',
  Rexona: 'rexona',
  'Riggs London': 'riggs-london',
  Secret: 'secret',
  Sence: 'sence',
  Vaseline: 'vaseline',
  'العروسة': 'al-arousa',
};

const categorySlugs: Record<string, string> = {
  'لوشن الجسم': 'body-lotion',
  'معطرات الجسم': 'body-deodorants',
  'معطرات جسم وبودي سبلاش': 'body-mists',
  'مقشرات الجسم': 'body-scrubs',
  'زيوت وسيرومات الشعر': 'hair-oils-serums',
};

function normalize(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFKD')
    .toLocaleLowerCase('ar')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function validateManifest(): void {
  if (manifest.length !== 66) throw new Error(`Expected 66 products, received ${manifest.length}.`);
  const variants = manifest.flatMap(product => product.variants);
  if (variants.length !== 113) throw new Error(`Expected 113 variants, received ${variants.length}.`);
  const slugs = new Set<string>();
  const productSkus = new Set<string>();
  const variantSkus = new Set<string>();
  const images = new Set<string>();
  for (const product of manifest) {
    if (slugs.has(product.slug)) throw new Error(`Duplicate product slug: ${product.slug}`);
    if (productSkus.has(product.sku)) throw new Error(`Duplicate product SKU: ${product.sku}`);
    if (!brandSlugs[product.brand]) throw new Error(`Unknown brand: ${product.brand}`);
    if (!categorySlugs[product.category]) throw new Error(`Unknown category: ${product.category}`);
    slugs.add(product.slug);
    productSkus.add(product.sku);
    for (const variant of product.variants) {
      if (!Number.isInteger(variant.priceFils) || variant.priceFils <= 0) throw new Error(`Bad price: ${variant.sku}`);
      if (!Number.isInteger(variant.costFils) || variant.costFils < 0) throw new Error(`Bad cost: ${variant.sku}`);
      if (variantSkus.has(variant.sku)) throw new Error(`Duplicate variant SKU: ${variant.sku}`);
      if (images.has(variant.imageName)) throw new Error(`Duplicate image assignment: ${variant.imageName}`);
      if (!fs.existsSync(variant.imagePath)) throw new Error(`Missing image: ${variant.imagePath}`);
      variantSkus.add(variant.sku);
      images.add(variant.imageName);
    }
  }
}

async function duplicateConflicts() {
  const existing = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      sku: true,
      nameAr: true,
      nameEn: true,
      brand: { select: { slug: true, nameAr: true, nameEn: true } },
    },
  });
  return manifest.flatMap(candidate => {
    const candidateBrand = brandSlugs[candidate.brand];
    return existing
      .filter(product => product.slug !== candidate.slug)
      .filter(product => {
        const sameBrand = product.brand?.slug === candidateBrand
          || normalize(product.brand?.nameAr) === normalize(candidate.brand)
          || normalize(product.brand?.nameEn) === normalize(candidate.brand);
        const sameName = normalize(product.nameAr) === normalize(candidate.nameAr)
          || normalize(product.nameEn) === normalize(candidate.nameEn);
        return product.sku === candidate.sku || (sameBrand && sameName);
      })
      .map(product => ({
        candidate: candidate.slug,
        candidateName: candidate.nameAr,
        existingId: product.id,
        existingSlug: product.slug,
        existingSku: product.sku,
        existingName: product.nameAr,
      }));
  });
}

async function main() {
  validateManifest();
  const supplier = await prisma.supplier.findFirst({
    where: { name: supplierName },
    select: { id: true, name: true, isActive: true, profitMargin: true },
  });
  if (!supplier?.isActive) throw new Error(`Active supplier not found: ${supplierName}`);

  const conflicts = await duplicateConflicts();
  const existingBatch = await prisma.product.count({ where: { slug: { in: manifest.map(product => product.slug) } } });
  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    supplier,
    products: manifest.length,
    variants: manifest.reduce((sum, product) => sum + product.variants.length, 0),
    existingBatch,
    duplicateConflicts: conflicts,
  }, null, 2));
  if (conflicts.length) throw new Error(`Refusing import: ${conflicts.length} duplicate conflict(s) found.`);
  if (!apply) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase storage credentials are missing.');
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const imageUrls = new Map<string, string>();
  for (const variant of manifest.flatMap(product => product.variants)) {
    const storagePath = `products/ghazal-209-356/${variant.imageName}`;
    const file = fs.readFileSync(variant.imagePath);
    const { error } = await supabase.storage.from('product-images').upload(storagePath, file, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    });
    if (error) throw new Error(`Upload failed for ${variant.imageName}: ${error.message}`);
    const publicUrl = supabase.storage.from('product-images').getPublicUrl(storagePath).data.publicUrl;
    const response = await fetch(publicUrl, { method: 'HEAD' });
    if (!response.ok) throw new Error(`Uploaded image is unreachable (${response.status}): ${publicUrl}`);
    imageUrls.set(variant.sku, publicUrl);
  }

  const brandIds = new Map<string, string>();
  for (const brandName of new Set(manifest.map(product => product.brand))) {
    const slug = brandSlugs[brandName];
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: { isVisible: true },
      create: {
        slug,
        nameAr: brandName,
        nameEn: brandName === 'العروسة' ? 'Al Arousa' : brandName,
        isVisible: true,
      },
    });
    brandIds.set(brandName, brand.id);
  }

  const categoryIds = new Map<string, string>();
  for (const categoryName of new Set(manifest.map(product => product.category))) {
    const slug = categorySlugs[categoryName];
    const category = await prisma.category.upsert({
      where: { slug },
      update: { name: categoryName, isVisible: true },
      create: { slug, name: categoryName, isVisible: true },
    });
    categoryIds.set(categoryName, category.id);
  }

  await prisma.$transaction(async tx => {
    for (const product of manifest) {
      const record = await tx.product.upsert({
        where: { slug: product.slug },
        update: {
          nameAr: product.nameAr,
          nameEn: product.nameEn,
          shortDescription: product.shortDescription,
          longDescription: product.longDescription,
          categoryId: categoryIds.get(product.category)!,
          brandId: brandIds.get(product.brand)!,
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
          longDescription: product.longDescription,
          categoryId: categoryIds.get(product.category)!,
          brandId: brandIds.get(product.brand)!,
          isVisible: true,
          needsReview: false,
          stockStatus: 'UNVERIFIED',
          notesStatus: 'VERIFIED',
        },
      });

      await tx.productImage.deleteMany({ where: { productId: record.id } });
      const activeSkus: string[] = [];
      for (const [index, variant] of product.variants.entries()) {
        const imageUrl = imageUrls.get(variant.sku)!;
        activeSkus.push(variant.sku);
        const saved = await tx.productVariant.upsert({
          where: { sku: variant.sku },
          update: {
            productId: record.id,
            name: variant.nameAr,
            size: variant.size,
            price: variant.priceFils,
            mainImage: imageUrl,
            isActive: true,
            inventorySource: 'SUPPLIER',
          },
          create: {
            productId: record.id,
            sku: variant.sku,
            name: variant.nameAr,
            size: variant.size,
            price: variant.priceFils,
            stock: 0,
            mainImage: imageUrl,
            isActive: true,
            inventorySource: 'SUPPLIER',
          },
        });
        await tx.productImage.create({
          data: {
            productId: record.id,
            variantId: saved.id,
            url: imageUrl,
            alt: `${product.nameAr} - ${variant.nameAr}`,
            type: 'PRIMARY',
            isMain: index === 0,
            order: index,
          },
        });
        const previousOffer = await tx.supplierOffer.findUnique({
          where: { supplierId_variantId: { supplierId: supplier.id, variantId: saved.id } },
          select: { stock: true },
        });
        await tx.supplierOffer.upsert({
          where: { supplierId_variantId: { supplierId: supplier.id, variantId: saved.id } },
          update: {
            unitCost: variant.costFils,
            supplierProfitShareBps: Math.round(supplier.profitMargin * 100),
            supplierSku: variant.sku,
            stock: previousOffer?.stock ?? 50,
            isActive: true,
          },
          create: {
            supplierId: supplier.id,
            variantId: saved.id,
            unitCost: variant.costFils,
            supplierProfitShareBps: Math.round(supplier.profitMargin * 100),
            supplierSku: variant.sku,
            stock: 50,
            isActive: true,
          },
        });
        await tx.supplierOffer.updateMany({
          where: { variantId: saved.id, supplierId: { not: supplier.id }, isActive: true },
          data: { isActive: false },
        });
      }
      await tx.productVariant.updateMany({
        where: { productId: record.id, sku: { notIn: activeSkus } },
        data: { isActive: false },
      });
    }
  }, { timeout: 120_000 });

  const slugs = manifest.map(product => product.slug);
  const [products, variants, offers, images] = await Promise.all([
    prisma.product.count({ where: { slug: { in: slugs }, isVisible: true } }),
    prisma.productVariant.count({ where: { product: { slug: { in: slugs } }, isActive: true } }),
    prisma.supplierOffer.count({ where: { supplierId: supplier.id, isActive: true, variant: { product: { slug: { in: slugs } } } } }),
    prisma.productImage.count({ where: { product: { slug: { in: slugs } } } }),
  ]);
  if (products !== 66 || variants !== 113 || offers !== 113 || images !== 113) {
    throw new Error(`Post-import audit failed: products=${products}, variants=${variants}, offers=${offers}, images=${images}`);
  }
  console.log(`IMPORT COMPLETE: ${products} products, ${variants} variants, ${offers} supplier offers, ${images} images.`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
