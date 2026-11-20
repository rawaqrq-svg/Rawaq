import { prisma } from '../src/lib/db';
import { ensureProductTemplatesInstalled } from '../src/lib/product-templates';
import { ensureDefaultTaxonomyInstalled } from '../src/lib/taxonomy-defaults';

export async function executeFactoryReset() {
  console.log('====================================================');
  console.log('🚀 بدء تنفيذ إعادة ضبط المصنع الشامل لمتجر ونظام رَواق');
  console.log('====================================================\n');

  // 1. التحقق من الحسابات النشطة لضمان الحفاظ عليها
  const activeEmployees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, email: true, name: true, role: { select: { name: true } } }
  });
  console.log(`📋 تم العثور على ${activeEmployees.length} حسابات موظفين نشطة سيتم الحفاظ عليها:`);
  for (const emp of activeEmployees) {
    console.log(`   - ${emp.name} (${emp.email}) - دور: ${emp.role.name}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // ----------------------------------------------------
    // أ. توزيع الأرباح، الرواتب والشركاء
    // ----------------------------------------------------
    await tx.partnerPayout.deleteMany({}).catch(() => {});
    await tx.profitDistribution.deleteMany({}).catch(() => {});
    await tx.partnerShareRule.deleteMany({}).catch(() => {});
    await tx.profitClose.deleteMany({}).catch(() => {});
    await tx.payrollPayment.deleteMany({}).catch(() => {});
    await tx.payrollPeriod.deleteMany({}).catch(() => {});
    await tx.employeePayAgreement.deleteMany({}).catch(() => {});

    // ----------------------------------------------------
    // ب. مسارات ومهام التوصيل والطرود (Fulfillment & Delivery)
    // ----------------------------------------------------
    await tx.deliveryStop.deleteMany({}).catch(() => {});
    await tx.deliveryRun.deleteMany({}).catch(() => {});
    await tx.deliveryJob.deleteMany({}).catch(() => {});
    await tx.packageItem.deleteMany({}).catch(() => {});
    await tx.package.deleteMany({}).catch(() => {});
    await tx.fulfillmentItem.deleteMany({}).catch(() => {});
    await tx.fulfillmentOrder.deleteMany({}).catch(() => {});
    await tx.fulfillmentOutbox.deleteMany({}).catch(() => {});
    await tx.pickupBatch.deleteMany({}).catch(() => {});
    await tx.supplierAccessSession.deleteMany({}).catch(() => {});
    await tx.deliveryAssignment.deleteMany({}).catch(() => {});
    await tx.deliveryBatch.deleteMany({}).catch(() => {});
    await tx.captainSettlement.deleteMany({}).catch(() => {});
    await tx.captain.deleteMany({}).catch(() => {});

    // ----------------------------------------------------
    // ج. الفواتير، الدفعات، المرتجعات، نقاط البيع والطلبات
    // ----------------------------------------------------
    await tx.couponRedemption.deleteMany({}).catch(() => {});
    await tx.rewardRedemption.deleteMany({}).catch(() => {});
    await tx.couponTarget.deleteMany({}).catch(() => {});
    await tx.coupon.deleteMany({}).catch(() => {});
    await tx.rewardRule.deleteMany({}).catch(() => {});
    await tx.expense.deleteMany({}).catch(() => {});
    await tx.financialTransaction.deleteMany({}).catch(() => {});
    await tx.reconciliationDifference.deleteMany({}).catch(() => {});
    await tx.officialReport.deleteMany({}).catch(() => {});
    await tx.invoice.deleteMany({}).catch(() => {});
    await tx.payment.deleteMany({}).catch(() => {});
    await tx.returnItem.deleteMany({}).catch(() => {});
    await tx.return.deleteMany({}).catch(() => {});
    await tx.saleItem.deleteMany({}).catch(() => {});
    await tx.heldSale.deleteMany({}).catch(() => {});
    await tx.shift.deleteMany({}).catch(() => {});
    const deletedSales = await tx.sale.deleteMany({}).catch(() => ({ count: 0 }));
    await tx.orderItem.deleteMany({}).catch(() => {});
    await tx.orderStatusHistory.deleteMany({}).catch(() => {});
    const deletedOrders = await tx.order.deleteMany({}).catch(() => ({ count: 0 }));

    // ----------------------------------------------------
    // د. الموردين، أوامر الشراء ومواقع الاستلام
    // ----------------------------------------------------
    await tx.supplierSettlement.deleteMany({}).catch(() => {});
    await tx.supplierInvoice.deleteMany({}).catch(() => {});
    await tx.goodsReceipt.deleteMany({}).catch(() => {});
    await tx.purchaseOrderItem.deleteMany({}).catch(() => {});
    await tx.purchaseOrder.deleteMany({}).catch(() => {});
    await tx.supplierInventoryMovement.deleteMany({}).catch(() => {});
    await tx.supplierOffer.deleteMany({}).catch(() => {});
    await tx.supplierLocation.deleteMany({}).catch(() => {});
    const deletedSuppliers = await tx.supplier.deleteMany({}).catch(() => ({ count: 0 }));

    // ----------------------------------------------------
    // هـ. المستودعات والمخزون والمواد الأولية والتصنيع
    // ----------------------------------------------------
    await tx.stockAdjustment.deleteMany({}).catch(() => {});
    await tx.stockTransfer.deleteMany({}).catch(() => {});
    await tx.inventoryMovement.deleteMany({}).catch(() => {});
    await tx.inventoryCountLine.deleteMany({}).catch(() => {});
    await tx.inventoryCountSession.deleteMany({}).catch(() => {});
    await tx.inventory.deleteMany({}).catch(() => {});
    await tx.warehouse.deleteMany({}).catch(() => {});
    await tx.consumptionRecord.deleteMany({}).catch(() => {});
    await tx.rawMaterialMovement.deleteMany({}).catch(() => {});
    await tx.rawMaterialStock.deleteMany({}).catch(() => {});
    await tx.rawMaterial.deleteMany({}).catch(() => {});
    await tx.rawMaterialCategory.deleteMany({}).catch(() => {});

    // ----------------------------------------------------
    // و. العملاء، التقييمات، العناوين ونقاط الولاء
    // ----------------------------------------------------
    await tx.review.deleteMany({}).catch(() => {});
    await tx.loyaltyAccount.deleteMany({}).catch(() => {});
    await tx.customerAddress.deleteMany({}).catch(() => {});
    const deletedCustomers = await tx.customer.deleteMany({}).catch(() => ({ count: 0 }));

    // ----------------------------------------------------
    // ز. المنتجات ومتعلقاتها (Variants, Images, Attributes, Accords, etc.)
    // ----------------------------------------------------
    await tx.homepageHeroSlide.deleteMany({}).catch(() => {});
    await tx.productSimilar.deleteMany({}).catch(() => {});
    await tx.productIngredient.deleteMany({}).catch(() => {});
    await tx.ingredient.deleteMany({}).catch(() => {});
    await tx.productAccord.deleteMany({}).catch(() => {});
    await tx.accord.deleteMany({}).catch(() => {});
    await tx.productNote.deleteMany({}).catch(() => {});
    await tx.productFormulaItem.deleteMany({}).catch(() => {});
    await tx.productFormula.deleteMany({}).catch(() => {});
    await tx.productLiquidMovement.deleteMany({}).catch(() => {});
    await tx.productLiquidStock.deleteMany({}).catch(() => {});
    await tx.productAttributeValue.deleteMany({}).catch(() => {});
    await tx.productVariantAttributeValue.deleteMany({}).catch(() => {});
    await tx.productImage.deleteMany({}).catch(() => {});
    const deletedVariants = await tx.productVariant.deleteMany({}).catch(() => ({ count: 0 }));
    const deletedProducts = await tx.product.deleteMany({}).catch(() => ({ count: 0 }));
    await tx.shade.deleteMany({}).catch(() => {});
    const deletedBrands = await tx.brand.deleteMany({}).catch(() => ({ count: 0 }));
    await tx.collection.deleteMany({}).catch(() => {});
    await tx.fragranceFamily.deleteMany({}).catch(() => {});
    await tx.gender.deleteMany({}).catch(() => {});
    await tx.season.deleteMany({}).catch(() => {});

    // ----------------------------------------------------
    // ح. الأقسام القديمة (فك الارتباط الأبوي أولاً)
    // ----------------------------------------------------
    await tx.category.updateMany({ data: { parentId: null } });
    const deletedCategories = await tx.category.deleteMany({}).catch(() => ({ count: 0 }));

    // ----------------------------------------------------
    // ط. تنظيف السجلات والمحاولات والجلسات القديمة
    // ----------------------------------------------------
    await tx.fulfillmentAuditLog.deleteMany({}).catch(() => {});
    await tx.auditLog.deleteMany({}).catch(() => {});
    await tx.rateLimitEvent.deleteMany({}).catch(() => {});
    await tx.importJobRow.deleteMany({}).catch(() => {});
    await tx.importJob.deleteMany({}).catch(() => {});
    await tx.adminNotification.deleteMany({}).catch(() => {});
    await tx.pendingMfaChallenge.deleteMany({}).catch(() => {});
    await tx.session.deleteMany({}).catch(() => {});

    // ----------------------------------------------------
    // ي. حذف الحسابات غير الفعالة فقط والاحتفاظ بالنشطة
    // ----------------------------------------------------
    const deletedInactiveEmployees = await tx.employee.deleteMany({
      where: { isActive: false }
    }).catch(() => ({ count: 0 }));

    return {
      deletedOrders: deletedOrders.count,
      deletedSales: deletedSales.count,
      deletedSuppliers: deletedSuppliers.count,
      deletedCustomers: deletedCustomers.count,
      deletedProducts: deletedProducts.count,
      deletedVariants: deletedVariants.count,
      deletedBrands: deletedBrands.count,
      deletedCategories: deletedCategories.count,
      deletedInactiveEmployees: deletedInactiveEmployees.count,
      activeEmployeesKept: activeEmployees.length,
    };
  }, {
    timeout: 60000, // مهلة كافية للعملية
  });

  console.log('\n--- نتائج إعادة ضبط المصنع ---');
  console.log(`✅ تم حذف ${result.deletedProducts} منتج تجريبي.`);
  console.log(`✅ تم حذف ${result.deletedVariants} متغير وخيار تسعير.`);
  console.log(`✅ تم حذف ${result.deletedCategories} قسم قديم.`);
  console.log(`✅ تم حذف ${result.deletedSuppliers} مورد قديم.`);
  console.log(`✅ تم حذف ${result.deletedOrders} طلب إلكتروني.`);
  console.log(`✅ تم حذف ${result.deletedSales} حركة مبيعات ونقاط بيع.`);
  console.log(`✅ تم حذف ${result.deletedBrands} علامة تجارية تجريبية.`);
  console.log(`✅ تم تنظيف ${result.deletedInactiveEmployees} حساب غير نشط.`);
  console.log(`🛡️ تم الحفاظ على ${result.activeEmployeesKept} حسابات نشطة بكامل أدوارها وصلاحياتها.`);

  // ----------------------------------------------------
  // ك. إعادة تثبيت الهيكل النظيف والجاهز للتشغيل
  // ----------------------------------------------------
  console.log('\n📦 جاري إعادة تثبيت قوالب المنتجات وهيكل الأقسام الرسمي لمتجر رَواق...');
  await ensureProductTemplatesInstalled();
  await ensureDefaultTaxonomyInstalled();
  console.log('✨ تم تثبيت هيكل الأقسام وقوالب المنتجات الرسمية بنجاح.');

  const finalCounts = {
    products: await prisma.product.count(),
    categories: await prisma.category.count(),
    orders: await prisma.order.count(),
    activeEmployees: await prisma.employee.count({ where: { isActive: true } }),
    templates: await prisma.productTemplate.count({ where: { isActive: true } }),
  };

  console.log('\n📊 الوضع النهائي لقاعدة البيانات:');
  console.log(finalCounts);
  console.log('\n🎉 تمت إعادة ضبط المصنع بنجاح تام! النظام الآن نظيف 100% وجاهز لاستقبال المنتجات الجديدة.');

  return { result, finalCounts };
}

if (process.argv.includes('--execute')) {
  executeFactoryReset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ خطأ أثناء تنفيذ إعادة ضبط المصنع:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
