import { prisma } from '../src/lib/db';

type Group = { slugs: string[]; nameAr: string; nameEn: string };

const groups: Group[] = [
  { slugs: ['ghaz-dove-gofresh-spray', 'ghaz-dove-nourish-spray', 'ghaz-dove-original-spray', 'ghaz-dove-invisible-spray'], nameAr: 'بخاخ مزيل عرق دوف', nameEn: 'Dove Deodorant Body Spray' },
  { slugs: ['ghaz-rexona-motionsense-spray-232', 'ghaz-rexona-motionsense-spray-233', 'ghaz-rexona-motionsense-spray-234', 'ghaz-rexona-motionsense-spray-235', 'ghaz-rexona-motionsense-spray-236', 'ghaz-rexona-motionsense-spray-237', 'ghaz-rexona-motionsense-spray-238'], nameAr: 'بخاخ مزيل عرق ريكسونا موشن سينس', nameEn: 'Rexona MotionSense Deodorant Body Spray' },
  { slugs: ['ghaz-boutique-rollon-299', 'ghaz-boutique-rollon-300', 'ghaz-boutique-rollon-301', 'ghaz-boutique-rollon-302', 'ghaz-boutique-rollon-303', 'ghaz-boutique-rollon-304', 'ghaz-boutique-rollon-305', 'ghaz-boutique-rollon-306', 'ghaz-boutique-rollon-307', 'ghaz-boutique-rollon-308'], nameAr: 'رول مزيل عرق بوتيك', nameEn: 'Boutique Deodorant Roll-On' },
  { slugs: ['ghaz-elegance-hair-serum-300-311', 'ghaz-elegance-hair-serum-300-312'], nameAr: 'سيروم شعر إليغانس بلس 300 مل', nameEn: 'Elegance Plus Hair Serum 300 ml' },
  { slugs: ['ghaz-agrado-body-milk-400-331', 'ghaz-agrado-body-milk-400-332', 'ghaz-agrado-body-milk-400-333', 'ghaz-agrado-body-milk-400-334', 'ghaz-agrado-body-milk-400-335'], nameAr: 'لوشن جسم أغرادو بودي ميلك 400 مل', nameEn: 'Agrado Body Milk Lotion 400 ml' },
  { slugs: ['ghaz-vaseline-glutavit-firm-180', 'ghaz-vaseline-glutavit-hijab-180'], nameAr: 'سيروم جسم فازلين غلوتا فيتامين 180 مل', nameEn: 'Vaseline Gluta Vitamin Body Serum 180 ml' },
  { slugs: ['ghaz-vaseline-intensive-400-337', 'ghaz-vaseline-intensive-400-338', 'ghaz-vaseline-intensive-400-339', 'ghaz-vaseline-intensive-400-340'], nameAr: 'لوشن جسم فازلين إنتنسيف كير 400 مل', nameEn: 'Vaseline Intensive Care Body Lotion 400 ml' },
  { slugs: ['ghaz-mbc-body-lotion-500-342', 'ghaz-mbc-body-lotion-500-343', 'ghaz-mbc-body-lotion-500-344', 'ghaz-mbc-body-lotion-500-345'], nameAr: 'لوشن يدين وجسم إم بي سي 500 مل', nameEn: 'MBC Hand & Body Lotion 500 ml' },
  { slugs: ['ghaz-boutique-scrub-600-347', 'ghaz-boutique-scrub-600-348', 'ghaz-boutique-scrub-600-349', 'ghaz-boutique-scrub-600-350', 'ghaz-boutique-scrub-600-351'], nameAr: 'مقشر الوجه والجسم بوتيك 600 مل', nameEn: 'Boutique Face & Body Scrub 600 ml' },
];

async function main() {
  const report: Array<Record<string, unknown>> = [];
  await prisma.$transaction(async tx => {
    for (const group of groups) {
      const products = await tx.product.findMany({ where: { slug: { in: group.slugs } }, orderBy: { slug: 'asc' }, include: { variants: true } });
      if (products.length === 0) { report.push({ slugs: group.slugs, status: 'already-merged-or-missing' }); continue; }
      if (products.length === 1) { report.push({ canonical: products[0].slug, status: 'already-merged', variants: products[0].variants.length }); continue; }
      const canonical = products[0];
      const duplicates = products.slice(1);
      const duplicateIds = duplicates.map(p => p.id);
      const variantCount = products.reduce((n, p) => n + p.variants.length, 0);
      await tx.product.update({ where: { id: canonical.id }, data: { nameAr: group.nameAr, nameEn: group.nameEn, shortDescription: `${group.nameAr} بخيارات متعددة حسب الرائحة أو النوع.`, isVisible: true } });
      await tx.productVariant.updateMany({ where: { productId: { in: duplicateIds } }, data: { productId: canonical.id } });
      await tx.productImage.updateMany({ where: { productId: { in: duplicateIds } }, data: { productId: canonical.id } });
      for (const duplicate of duplicates) {
        const dependent = await tx.product.findUnique({ where: { id: duplicate.id }, select: { _count: { select: { variants: true, images: true, orderItems: true, reviews: true, attributeValues: true } } } });
        if (dependent?._count.variants !== 0 || dependent?._count.images !== 0 || dependent?._count.orderItems !== 0 || dependent?._count.reviews !== 0 || dependent?._count.attributeValues !== 0) throw new Error(`Merge dependency remains for ${duplicate.slug}: ${JSON.stringify(dependent?._count)}`);
        await tx.product.delete({ where: { id: duplicate.id } });
      }
      report.push({ canonical: canonical.slug, removed: duplicates.map(p => p.slug), variants: variantCount });
    }
  }, { timeout: 120_000 });
  const checks = await Promise.all(groups.map(async group => {
    const products = await prisma.product.findMany({ where: { slug: { in: group.slugs } }, select: { slug: true, nameAr: true, variants: { where: { isActive: true }, select: { sku: true, name: true, price: true, mainImage: true, supplierOffers: { where: { isActive: true }, select: { unitCost: true, supplierId: true } }, images: { select: { url: true } } } } } });
    return { group: group.nameAr, products: products.length, variants: products.reduce((n, p) => n + p.variants.length, 0), missingImages: products.flatMap(p => p.variants).filter(v => !v.mainImage || v.images.length === 0).length, missingCosts: products.flatMap(p => p.variants).filter(v => v.supplierOffers.length === 0 || v.supplierOffers.some(o => o.unitCost < 0)).length };
  }));
  console.log(JSON.stringify({ report, checks }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
