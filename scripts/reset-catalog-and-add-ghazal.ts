import { prisma } from '../src/lib/db';

export async function resetCatalogAndAddGhazal() {
  console.log('--- بدء عملية إعادة ضبط الكتالوج وحذف الأقسام والمنتجات والمحلات القديمة ---');

  const result = await prisma.$transaction(async (tx) => {
    // 1. تنظيف متعلقات الطلبات والتسليم المرتبطة بالمنتجات السابقة
    await tx.deliveryStop.deleteMany({}).catch(() => {});
    await tx.deliveryJob.deleteMany({}).catch(() => {});
    await tx.packageItem.deleteMany({}).catch(() => {});
    await tx.package.deleteMany({}).catch(() => {});
    await tx.fulfillmentItem.deleteMany({}).catch(() => {});
    await tx.fulfillmentOrder.deleteMany({}).catch(() => {});
    await tx.fulfillmentOutbox.deleteMany({}).catch(() => {});
    await tx.returnItem.deleteMany({}).catch(() => {});
    await tx.saleItem.deleteMany({}).catch(() => {});
    await tx.orderItem.deleteMany({}).catch(() => {});
    await tx.orderStatusHistory.deleteMany({}).catch(() => {});
    await tx.order.deleteMany({}).catch(() => {});

    // 2. تنظيف عروض الموردين والمخزون والصور والمتغيرات والمنتجات
    await tx.supplierOffer.deleteMany({});
    await tx.inventory.deleteMany({}).catch(() => {});
    await tx.productImage.deleteMany({});
    await tx.productVariant.deleteMany({});
    const deletedProducts = await tx.product.deleteMany({});

    // 3. تنظيف الأقسام القديمة
    // فك ارتباط الأقسام الأبوية أولاً لتجنب قيود المفاتيح
    await tx.category.updateMany({ data: { parentId: null } });
    const deletedCategories = await tx.category.deleteMany({});

    // 4. حذف المحلات / الموردين القدامى
    const deletedSuppliers = await tx.supplier.deleteMany({});

    // 5. إضافة محل "غزل للمكياجات"
    const ghazalShop = await tx.supplier.create({
      data: {
        name: 'محل غزل للمكياجات',
        ownerName: 'غزل',
        phone: '0790000000',
        email: 'ghazal.makeup@rawaq.local',
        notes: 'المحل الرئيسي لمستحضرات التجميل والعناية',
        profitMargin: 30,
        isActive: true,
      }
    });

    return {
      deletedProducts: deletedProducts.count,
      deletedCategories: deletedCategories.count,
      deletedSuppliers: deletedSuppliers.count,
      ghazalShopId: ghazalShop.id,
      ghazalShopName: ghazalShop.name,
    };
  });

  console.log('--- اكتملت العملية بنجاح ---');
  console.log(`- تم حذف ${result.deletedProducts} منتج`);
  console.log(`- تم حذف ${result.deletedCategories} قسم`);
  console.log(`- تم حذف ${result.deletedSuppliers} مورد/محل قديم`);
  console.log(`- تم إنشاء: ${result.ghazalShopName} (ID: ${result.ghazalShopId})`);
  return result;
}

if (process.argv.includes('--execute')) {
  resetCatalogAndAddGhazal()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('خطأ أثناء العملية:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
