import { prisma } from '../src/lib/db';

async function main() {
  const product = await prisma.product.findUniqueOrThrow({
    where: { slug: 'ghazal-screen-356' },
    select: { id: true, variants: { select: { id: true, sku: true } } },
  });
  const oldVariant = product.variants.find(variant => variant.sku === 'None');
  const correctSku = 'GHAZAL-SCREEN-356-356';
  if (!oldVariant) {
    const alreadyFixed = product.variants.some(variant => variant.sku === correctSku);
    if (!alreadyFixed) throw new Error('Neither the old nor corrected screen 356 SKU exists.');
    console.log('Screen 356 SKU already fixed.');
    return;
  }
  if (product.variants.some(variant => variant.sku === correctSku)) {
    throw new Error('Corrected screen 356 SKU already belongs to another variant.');
  }
  await prisma.$transaction(async tx => {
    await tx.productVariant.update({ where: { id: oldVariant.id }, data: { sku: correctSku } });
    await tx.supplierOffer.updateMany({ where: { variantId: oldVariant.id }, data: { supplierSku: correctSku } });
  });
  console.log(`Corrected ${oldVariant.id} to ${correctSku}.`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
