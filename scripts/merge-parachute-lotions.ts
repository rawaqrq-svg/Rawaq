import { prisma } from '../src/lib/db';

const APPLY = process.argv.includes('--apply');

const TARGET = {
  id: '65018739-e8f5-43b2-9d8e-40d0e5743fd9',
  slug: 'parachute-skinpure-body-lotion',
  sku: 'GHAZ-BODY-PARACHUTE',
  nameAr: 'لوشن الجسم باراشوت سكين بيور',
  nameEn: 'Parachute SkinPure Body Lotion',
};

const SOURCES = [
  {
    productId: '65018739-e8f5-43b2-9d8e-40d0e5743fd9',
    productSku: 'GHAZ-BODY-053',
    variantSku: 'GHAZ-BODY-053',
    option: 'كاكاو + فيتامين B5',
    image: '/images/products/parachute/parachute-skinpure-cocoa-vitamin-b5.webp',
  },
  {
    productId: '6280012f-f851-4c45-a03f-dfb24684477e',
    productSku: 'GHAZ-BODY-054',
    variantSku: 'GHAZ-BODY-054',
    option: 'جوز الهند + فيتامين E',
    image: '/images/products/parachute/parachute-skinpure-coconut-vitamin-e.webp',
  },
  {
    productId: 'dbc4c91d-e1b5-4220-8dc9-0ecacbca28d0',
    productSku: 'GHAZ-BODY-055',
    variantSku: 'GHAZ-BODY-055',
    option: 'فيتامين C',
    image: '/images/products/parachute/parachute-skinpure-vitamin-c.webp',
  },
  {
    productId: 'fb7735a9-6a38-461e-834d-5c7aa393cd5b',
    productSku: 'GHAZ-BODY-056',
    variantSku: 'GHAZ-BODY-056',
    option: 'حمض الهيالورونيك',
    image: '/images/products/parachute/parachute-skinpure-hyaluron.webp',
  },
] as const;

async function inspect() {
  const products = await prisma.product.findMany({
    where: { id: { in: SOURCES.map((item) => item.productId) } },
    include: {
      images: true,
      variants: { include: { images: true, supplierOffers: true } },
    },
  });

  const variants = products.flatMap((product) => product.variants);
  const sourceByProductId = new Map(SOURCES.map((item) => [item.productId, item]));

  return {
    products,
    variants,
    summary: products.map((product) => ({
      id: product.id,
      sku: product.sku,
      nameAr: product.nameAr,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        currentImage: variant.mainImage,
        targetImage: sourceByProductId.get(product.id)?.image,
        activeSupplierOffers: variant.supplierOffers.filter((offer) => offer.isActive).length,
      })),
    })),
  };
}

async function main() {
  const before = await inspect();
  const alreadyMerged =
    before.products.length === 1 &&
    before.products[0]?.id === TARGET.id &&
    before.products[0]?.variants.length === SOURCES.length &&
    before.products[0]?.slug === TARGET.slug;

  if (alreadyMerged) {
    console.log(JSON.stringify({ status: 'already-merged', ...before.summary[0] }, null, 2));
    return;
  }

  if (before.products.length !== SOURCES.length) {
    throw new Error(`Expected ${SOURCES.length} source products, found ${before.products.length}.`);
  }

  for (const source of SOURCES) {
    const product = before.products.find((item) => item.id === source.productId);
    if (!product || product.sku !== source.productSku || product.variants.length !== 1) {
      throw new Error(`Precondition failed for ${source.productSku}.`);
    }
    if (product.variants[0]?.sku !== source.variantSku) {
      throw new Error(`Unexpected variant SKU for ${source.productSku}.`);
    }
  }

  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', products: before.summary }, null, 2));
  if (!APPLY) return;

  await prisma.$transaction(async (tx) => {
    for (const [order, source] of SOURCES.entries()) {
      const product = before.products.find((item) => item.id === source.productId)!;
      const variant = product.variants[0]!;

      await tx.productVariant.update({
        where: { id: variant.id },
        data: {
          productId: TARGET.id,
          name: source.option,
          mainImage: source.image,
        },
      });

      const image = product.images.find((item) => item.variantId === variant.id) ?? product.images[0];
      if (image) {
        await tx.productImage.update({
          where: { id: image.id },
          data: {
            productId: TARGET.id,
            variantId: variant.id,
            url: source.image,
            alt: `${TARGET.nameAr} - ${source.option}`,
            isMain: order === 0,
            order,
            type: 'PRIMARY',
          },
        });
      } else {
        await tx.productImage.create({
          data: {
            productId: TARGET.id,
            variantId: variant.id,
            url: source.image,
            alt: `${TARGET.nameAr} - ${source.option}`,
            isMain: order === 0,
            order,
            type: 'PRIMARY',
          },
        });
      }
    }

    await tx.productImage.deleteMany({
      where: {
        productId: { in: SOURCES.map((item) => item.productId) },
        variantId: null,
      },
    });

    await tx.product.deleteMany({
      where: {
        id: { in: SOURCES.map((item) => item.productId).filter((id) => id !== TARGET.id) },
      },
    });

    await tx.product.update({
      where: { id: TARGET.id },
      data: {
        slug: TARGET.slug,
        sku: TARGET.sku,
        nameAr: TARGET.nameAr,
        nameEn: TARGET.nameEn,
        shortDescription: 'لوشن جسم مرطب من باراشوت سكين بيور بأربع تركيبات عناية ضمن منتج واحد.',
        longDescription:
          'لوشن باراشوت سكين بيور بتركيبة خفيفة وسريعة الامتصاص لترطيب البشرة والعناية اليومية. اختاري من الكاكاو وفيتامين B5، جوز الهند وفيتامين E، فيتامين C، أو حمض الهيالورونيك.',
        benefits: 'ترطيب يومي، ملمس ناعم، امتصاص سريع، خيارات متعددة حسب احتياج البشرة',
        howToUse: 'يوزع على بشرة نظيفة وجافة ويدلك بلطف حتى الامتصاص، ويكرر الاستخدام عند الحاجة.',
        tags: 'باراشوت,سكين بيور,لوشن جسم,ترطيب,فيتامين C,فيتامين E,هيالورونيك,كاكاو',
        isVisible: true,
        needsReview: false,
        reviewReasons: null,
      },
    });
  });

  const after = await prisma.product.findUnique({
    where: { id: TARGET.id },
    include: {
      images: { orderBy: { order: 'asc' } },
      variants: {
        orderBy: { sku: 'asc' },
        include: { images: true, supplierOffers: true },
      },
    },
  });

  if (!after || after.variants.length !== SOURCES.length || after.images.length !== SOURCES.length) {
    throw new Error('Post-migration verification failed.');
  }
  if (after.variants.some((variant) => variant.images.length !== 1 || variant.supplierOffers.length !== 1)) {
    throw new Error('Variant image or supplier-offer verification failed.');
  }

  console.log(JSON.stringify({
    status: 'merged',
    product: {
      id: after.id,
      slug: after.slug,
      sku: after.sku,
      nameAr: after.nameAr,
      variants: after.variants.map((variant) => ({
        sku: variant.sku,
        name: variant.name,
        image: variant.mainImage,
        supplierOffers: variant.supplierOffers.length,
      })),
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
