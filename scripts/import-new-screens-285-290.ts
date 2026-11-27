import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../src/lib/db';

const root = path.resolve(process.cwd(), '..', 'design', 'جاهز_للمتجر_studio_webp');
const supplierName = 'محل غزل للمكياجات';
const imageBase = 'https://mvvsofjitybxjhxorruw.supabase.co/storage/v1/object/public/product-images/products/ghazal-new-285-290';

const higeen = [
  { sku: 'GHAZ-HIGEEN-ROLLON-FRUITY-FRESH-285', name: 'فروتي فريش', en: 'Fruity Fresh', file: 'higeen-fruity-fresh-rollon-studio.webp' },
  { sku: 'GHAZ-HIGEEN-ROLLON-HAIR-MINIMIZING-286', name: 'تقليل نمو الشعر', en: 'Hair Minimizing', file: 'higeen-hair-minimizing-rollon-studio.webp' },
];
const dove = [
  { sku: 'GHAZ-DOVE-RADIANT-CARE-COLLAGEN-287', name: 'كولاجين', en: 'Collagen', file: 'dove-radiant-care-collagen-studio.webp' },
  { sku: 'GHAZ-DOVE-RADIANT-CARE-NIGHT-REPAIR-288', name: 'نايت ريبير', en: 'Night Repair', file: 'dove-radiant-care-night-repair-studio.webp' },
  { sku: 'GHAZ-DOVE-RADIANT-CARE-SENSITIVE-289', name: 'للبشرة الحساسة', en: 'Sensitive Care', file: 'dove-radiant-care-sensitive-studio.webp' },
  { sku: 'GHAZ-DOVE-RADIANT-CARE-VITAMIN-CARE-290', name: 'فيتامين كير', en: 'Vitamin Care', file: 'dove-radiant-care-vitamin-care-studio.webp' },
];

async function uploadAndCheck(supabase: ReturnType<typeof createClient>, fileName: string) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Missing studio image: ${filePath}`);
  const storagePath = `products/ghazal-new-285-290/${fileName}`;
  const { error } = await supabase.storage.from('product-images').upload(storagePath, fs.readFileSync(filePath), { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
  if (error) throw new Error(`Image upload failed for ${fileName}: ${error.message}`);
  const url = `${imageBase}/${fileName}`;
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) throw new Error(`Image is not reachable (${response.status}): ${url}`);
  return url;
}

async function addVariant(tx: typeof prisma, productId: string, supplierId: string, item: { sku: string; name: string; en: string; file: string }, imageUrl: string) {
  const variant = await tx.productVariant.upsert({ where: { sku: item.sku }, update: { productId, name: item.name, size: 'عبوة واحدة', price: 2000, mainImage: imageUrl, isActive: true, inventorySource: 'SUPPLIER' }, create: { productId, sku: item.sku, name: item.name, size: 'عبوة واحدة', price: 2000, stock: 0, mainImage: imageUrl, isActive: true, inventorySource: 'SUPPLIER' } });
  await tx.productImage.deleteMany({ where: { variantId: variant.id } });
  await tx.productImage.create({ data: { productId, variantId: variant.id, url: imageUrl, alt: item.name, type: 'PRIMARY', isMain: false, order: 0 } });
  await tx.supplierOffer.upsert({ where: { supplierId_variantId: { supplierId, variantId: variant.id } }, update: { unitCost: 1200, supplierProfitShareBps: 5000, supplierSku: item.sku, stock: 50, isActive: true }, create: { supplierId, variantId: variant.id, unitCost: 1200, supplierProfitShareBps: 5000, supplierSku: item.sku, stock: 50, isActive: true } });
  return variant.id;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
  if (!url || !key) throw new Error('Supabase storage credentials are missing.');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const supplier = await prisma.supplier.findFirstOrThrow({ where: { name: supplierName }, select: { id: true } });
  const brandHigeen = await prisma.brand.findFirstOrThrow({ where: { slug: 'higeen' }, select: { id: true } });
  const brandDove = await prisma.brand.findFirstOrThrow({ where: { slug: 'dove' }, select: { id: true } });
  const category = await prisma.category.findFirstOrThrow({ where: { slug: 'body-deodorants' }, select: { id: true } });
  const urls = new Map<string, string>();
  for (const item of [...higeen, ...dove]) urls.set(item.file, await uploadAndCheck(supabase, item.file));
  const higeenProduct = await prisma.product.findUniqueOrThrow({ where: { slug: 'ghaz-higeen-rollon-black' }, select: { id: true } });
  const doveProduct = await prisma.product.upsert({ where: { slug: 'ghaz-dove-radiant-care-serum' }, update: { nameAr: 'سيروم مزيل عرق دوف راديانت كير', nameEn: 'Dove Radiant+Care Deodorant Serum', categoryId: category.id, brandId: brandDove.id, isVisible: true, needsReview: false }, create: { slug: 'ghaz-dove-radiant-care-serum', sku: 'GHAZ-DOVE-RADIANT-CARE-SERUM', nameAr: 'سيروم مزيل عرق دوف راديانت كير', nameEn: 'Dove Radiant+Care Deodorant Serum', shortDescription: 'سيروم مزيل عرق دوف راديانت كير بخيارات متعددة.', longDescription: 'سيروم مزيل عرق دوف راديانت كير بتركيبات متعددة للعناية بالمنطقة الحساسة وتوحيد مظهر البشرة.', categoryId: category.id, brandId: brandDove.id, isVisible: true, needsReview: false, notesStatus: 'VERIFIED', stockStatus: 'UNVERIFIED' } });
  await prisma.$transaction(async tx => {
    for (const item of higeen) await addVariant(tx, higeenProduct.id, supplier.id, item, urls.get(item.file)!);
    for (const item of dove) await addVariant(tx, doveProduct.id, supplier.id, item, urls.get(item.file)!);
    const first = await tx.productImage.findFirst({ where: { productId: higeenProduct.id } });
    if (first) await tx.productImage.update({ where: { id: first.id }, data: { isMain: true } });
    const firstDove = await tx.productImage.findFirst({ where: { productId: doveProduct.id } });
    if (firstDove) await tx.productImage.update({ where: { id: firstDove.id }, data: { isMain: true } });
    await tx.product.update({ where: { id: higeenProduct.id }, data: { nameAr: 'رول مزيل عرق هايجين', nameEn: 'HiGeen Deodorant Roll-On' } });
  }, { timeout: 120_000 });
  const verify = await prisma.product.findMany({ where: { slug: { in: ['ghaz-higeen-rollon-black', 'ghaz-dove-radiant-care-serum'] } }, select: { slug: true, nameAr: true, variants: { where: { isActive: true }, select: { sku: true, name: true, price: true, mainImage: true, images: { select: { url: true } }, supplierOffers: { where: { supplierId: supplier.id, isActive: true }, select: { unitCost: true } } } } } });
  console.log(JSON.stringify(verify, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
