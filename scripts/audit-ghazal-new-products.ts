import { prisma } from '../src/lib/db';
import { catalogBatch78194 } from './catalog-batch-78-194';

async function main() {
  const suppliers = await prisma.supplier.findMany({
    where: { name: 'محل غزل للمكياجات' },
    select: {
      id: true,
      name: true,
      profitMargin: true,
      isActive: true,
      offers: {
        select: {
          unitCost: true,
          supplierProfitShareBps: true,
          stock: true,
          isActive: true,
          variant: { select: { price: true, product: { select: { slug: true, nameAr: true } } } },
        },
      },
    },
  });

  const products = await prisma.product.findMany({
    where: { slug: { in: catalogBatch78194.map((product) => product.slug) } },
    select: {
      slug: true,
      nameAr: true,
      variants: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          inventorySource: true,
          supplierOffers: {
            select: { supplierId: true, unitCost: true, stock: true, isActive: true },
          },
        },
      },
    },
    orderBy: { nameAr: 'asc' },
  });

  console.log(JSON.stringify({
    suppliers: suppliers.map((supplier) => ({
      ...supplier,
      offerCount: supplier.offers.length,
      activeOfferCount: supplier.offers.filter((offer) => offer.isActive).length,
      costRatios: supplier.offers
        .filter((offer) => offer.variant.price > 0)
        .map((offer) => Number((offer.unitCost / offer.variant.price).toFixed(3))),
    })),
    newCatalog: {
      products: products.length,
      variants: products.reduce((sum, product) => sum + product.variants.length, 0),
      linkedOffers: products.reduce(
        (sum, product) => sum + product.variants.reduce((variantSum, variant) => variantSum + variant.supplierOffers.length, 0),
        0,
      ),
      inventorySources: Array.from(new Set(products.flatMap((product) => product.variants.map((variant) => variant.inventorySource)))),
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
