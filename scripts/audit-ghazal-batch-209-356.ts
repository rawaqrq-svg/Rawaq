import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '../src/lib/db';

type ManifestProduct = { slug: string };

async function main() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'scripts', 'ghazal-batch-209-356.json'), 'utf8'),
  ) as ManifestProduct[];
  const slugs = manifest.map(product => product.slug);
  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { name: 'محل غزل للمكياجات', isActive: true },
    select: { id: true, name: true },
  });
  const products = await prisma.product.findMany({
    where: { slug: { in: slugs } },
    select: {
      id: true,
      slug: true,
      sku: true,
      nameAr: true,
      createdAt: true,
      isVisible: true,
      needsReview: true,
      variants: {
        orderBy: { sku: 'asc' },
        select: {
          id: true,
          sku: true,
          name: true,
          price: true,
          mainImage: true,
          isActive: true,
          inventorySource: true,
          images: { select: { id: true, url: true, isMain: true } },
          supplierOffers: {
            where: { supplierId: supplier.id, isActive: true },
            select: { id: true, unitCost: true, stock: true, isActive: true },
          },
        },
      },
    },
    orderBy: { slug: 'asc' },
  });

  const variants = products.flatMap(product => product.variants);
  const failures = [
    products.length !== 66 ? `products=${products.length}` : null,
    variants.length !== 113 ? `variants=${variants.length}` : null,
    products.some(product => !product.isVisible || product.needsReview) ? 'product flags' : null,
    variants.some(variant => !variant.isActive || variant.inventorySource !== 'SUPPLIER') ? 'variant flags' : null,
    variants.some(variant => !variant.mainImage?.startsWith('https://')) ? 'variant images' : null,
    variants.some(variant => variant.images.length !== 1) ? 'image rows' : null,
    variants.some(variant => variant.supplierOffers.length !== 1) ? 'supplier offers' : null,
  ].filter(Boolean);
  if (failures.length) throw new Error(`Audit failed: ${failures.join(', ')}`);

  const output = path.join(process.cwd(), 'scripts', 'ghazal-batch-209-356-results.json');
  fs.writeFileSync(output, JSON.stringify({ supplier, products }, null, 2));
  console.log(JSON.stringify({
    products: products.length,
    variants: variants.length,
    images: variants.reduce((sum, variant) => sum + variant.images.length, 0),
    offers: variants.reduce((sum, variant) => sum + variant.supplierOffers.length, 0),
    allSupplierInventory: variants.every(variant => variant.inventorySource === 'SUPPLIER'),
    allPublicImages: variants.every(variant => variant.mainImage?.startsWith('https://')),
    resultsFile: output,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
