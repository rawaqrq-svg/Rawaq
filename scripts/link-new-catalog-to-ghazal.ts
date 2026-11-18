import { prisma } from '../src/lib/db';
import { catalogBatch78194, catalogVariantCount } from './catalog-batch-78-194';

const apply = process.argv.includes('--apply');
const rollback = process.argv.includes('--rollback');
const ratioArg = process.argv.find((arg) => arg.startsWith('--cost-ratio='));
const costRatio = ratioArg ? Number(ratioArg.split('=')[1]) : Number.NaN;
const supplierName = 'محل غزل للمكياجات';

function roundedCost(priceFils: number, ratio: number): number {
  return Math.max(0, Math.round((priceFils * ratio) / 250) * 250);
}

async function main() {
  if (apply && rollback) throw new Error('استخدم --apply أو --rollback، وليس الاثنين معاً.');
  if (!rollback && (!Number.isFinite(costRatio) || costRatio <= 0 || costRatio > 1)) {
    throw new Error('حدد نسبة تكلفة صالحة، مثال: --cost-ratio=0.70');
  }

  const supplier = await prisma.supplier.findFirst({
    where: { name: supplierName },
    select: { id: true, name: true, profitMargin: true, isActive: true },
  });
  if (!supplier?.isActive) throw new Error(`المورد النشط غير موجود: ${supplierName}`);

  const productSlugs = catalogBatch78194.map((product) => product.slug);
  const products = await prisma.product.findMany({
    where: { slug: { in: productSlugs } },
    select: {
      id: true,
      slug: true,
      sku: true,
      nameAr: true,
      variants: {
        select: {
          id: true,
          sku: true,
          name: true,
          price: true,
          inventorySource: true,
          supplierOffers: {
            where: { supplierId: supplier.id },
            select: { id: true, unitCost: true, stock: true, isActive: true },
          },
        },
      },
    },
  });

  const variantCount = products.reduce((sum, product) => sum + product.variants.length, 0);
  const missingProducts = productSlugs.filter((slug) => !products.some((product) => product.slug === slug));
  if (missingProducts.length) throw new Error(`منتجات مفقودة: ${missingProducts.join(', ')}`);
  if (products.length !== catalogBatch78194.length || variantCount !== catalogVariantCount) {
    throw new Error(`فشل شرط السلامة: ${products.length} منتج و${variantCount} خيار، المتوقع 21 و99.`);
  }

  if (rollback) {
    if (!apply) {
      console.log(`ROLLBACK DRY RUN: سيُعطّل ${variantCount} عرضاً ويعيد الخيارات إلى INTERNAL.`);
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.supplierOffer.updateMany({
        where: { supplierId: supplier.id, variantId: { in: products.flatMap((product) => product.variants.map((variant) => variant.id)) } },
        data: { isActive: false },
      });
      await tx.productVariant.updateMany({
        where: { id: { in: products.flatMap((product) => product.variants.map((variant) => variant.id)) } },
        data: { inventorySource: 'INTERNAL' },
      });
    });
    console.log(`ROLLBACK COMPLETE: عُطّل الربط لـ${variantCount} خياراً.`);
    return;
  }

  const plan = products.flatMap((product) => product.variants.map((variant) => ({
    product: product.nameAr,
    productSlug: product.slug,
    variantId: variant.id,
    variant: variant.name,
    sku: variant.sku,
    price: variant.price,
    unitCost: roundedCost(variant.price, costRatio),
    previousOffer: variant.supplierOffers[0] || null,
  })));
  const totalRetail = plan.reduce((sum, item) => sum + item.price, 0);
  const totalCost = plan.reduce((sum, item) => sum + item.unitCost, 0);
  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    supplier,
    products: products.length,
    variants: plan.length,
    costRatio,
    roundedAverageRatio: Number((totalCost / totalRetail).toFixed(4)),
    existingLinkedOffers: plan.filter((item) => item.previousOffer).length,
    sample: plan.slice(0, 8).map((item) => ({
      product: item.product,
      variant: item.variant,
      priceFils: item.price,
      unitCostFils: item.unitCost,
    })),
  }, null, 2));
  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    for (const item of plan) {
      await tx.supplierOffer.upsert({
        where: { supplierId_variantId: { supplierId: supplier.id, variantId: item.variantId } },
        create: {
          supplierId: supplier.id,
          variantId: item.variantId,
          unitCost: item.unitCost,
          supplierProfitShareBps: supplier.profitMargin * 100,
          stock: 50,
          supplierSku: item.sku,
          isActive: true,
        },
        update: {
          unitCost: item.unitCost,
          supplierProfitShareBps: supplier.profitMargin * 100,
          stock: item.previousOffer?.stock ?? 50,
          supplierSku: item.sku,
          isActive: true,
        },
      });
      await tx.supplierOffer.updateMany({
        where: { variantId: item.variantId, supplierId: { not: supplier.id }, isActive: true },
        data: { isActive: false },
      });
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { inventorySource: 'SUPPLIER' },
      });
    }
  }, { timeout: 30_000 });

  const linked = await prisma.supplierOffer.count({
    where: {
      supplierId: supplier.id,
      isActive: true,
      variant: { product: { slug: { in: productSlugs } } },
    },
  });
  if (linked !== catalogVariantCount) throw new Error(`التحقق بعد الكتابة فشل: ${linked}/99 عرضاً نشطاً.`);
  console.log(`LINK COMPLETE: ${products.length} منتج، ${linked} خياراً مرتبطاً بالمورد.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
