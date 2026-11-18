import { prisma } from '../src/lib/db';
import { catalogBatch78194 } from './catalog-batch-78-194';

async function main() {
  const batchSlugs = catalogBatch78194.map((product) => product.slug);
  const imported = await prisma.product.findMany({
    where: { slug: { in: batchSlugs } },
    select: {
      slug: true,
      isVisible: true,
      images: { select: { id: true, isMain: true, url: true } },
      variants: { select: { id: true, isActive: true, mainImage: true } },
    },
  });
  const missingBatch = batchSlugs.filter((slug) => !imported.some((product) => product.slug === slug));
  const invalidBatch = imported.filter((product) =>
    !product.isVisible ||
    product.images.length === 0 ||
    !product.images.some((image) => image.isMain) ||
    product.variants.length === 0 ||
    product.variants.some((variant) => !variant.mainImage),
  );

  const unhealthyVisible = await prisma.product.findMany({
    where: {
      isVisible: true,
      OR: [{ images: { none: {} } }, { variants: { none: {} } }],
    },
    select: {
      id: true,
      slug: true,
      nameAr: true,
      nameEn: true,
      _count: { select: { images: true, variants: true } },
    },
    orderBy: { nameAr: 'asc' },
  });

  const jefan = await prisma.product.findMany({
    where: {
      OR: [
        { nameAr: { contains: 'جفان', mode: 'insensitive' } },
        { nameEn: { contains: 'Jefan', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      slug: true,
      nameAr: true,
      nameEn: true,
      isVisible: true,
      _count: { select: { images: true, variants: true, orderItems: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(JSON.stringify({
    imported: imported.length,
    importedVariants: imported.reduce((sum, product) => sum + product.variants.length, 0),
    importedImages: imported.reduce((sum, product) => sum + product.images.length, 0),
    missingBatch,
    invalidBatch: invalidBatch.map((product) => product.slug),
    unhealthyVisible,
    jefan,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
