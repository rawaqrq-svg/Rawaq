import { prisma } from '../src/lib/db';

async function main() {
  const [products, variants, categories, suppliers, orders, orderItems] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.category.count(),
    prisma.supplier.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
  ]);

  console.log('CURRENT COUNTS:');
  console.log({ products, variants, categories, suppliers, orders, orderItems });

  const supplierList = await prisma.supplier.findMany({ select: { id: true, name: true } });
  console.log('Suppliers:', supplierList);
}

main().catch(console.error).finally(() => prisma.$disconnect());
