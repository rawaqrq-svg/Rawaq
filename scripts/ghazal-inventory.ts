import { prisma } from '../src/lib/db';

async function main() {
  const suppliers = await prisma.supplier.findMany({
    where: { name: 'محل غزل للمكياجات' },
    select: { id: true, name: true, isActive: true },
  });
  const supplierIds = suppliers.map((supplier) => supplier.id);
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: { variants: { some: { supplierOffers: { some: { supplierId: { in: supplierIds } } } } } },
      select: {
        id: true, slug: true, sku: true, nameAr: true, nameEn: true,
        shortDescription: true, longDescription: true, howToUse: true, benefits: true,
        categoryId: true, brandId: true, isVisible: true,
        images: { select: { id: true, url: true, isMain: true, variantId: true } },
        variants: {
          select: {
            id: true, name: true, size: true, colorName: true, sku: true, price: true,
            mainImage: true, isActive: true,
            supplierOffers: { where: { supplierId: { in: supplierIds } }, select: { supplierId: true, unitCost: true, isActive: true } },
          },
        },
      },
      orderBy: { nameAr: 'asc' },
    }),
    prisma.category.findMany({ select: { id: true, name: true, parentId: true, slug: true } }),
    prisma.brand.findMany({ select: { id: true, nameAr: true, nameEn: true } }),
  ]);
  process.stdout.write(`INVENTORY_JSON=${JSON.stringify({ suppliers, products, categories, brands })}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
