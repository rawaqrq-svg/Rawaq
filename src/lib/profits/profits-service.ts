import { prisma } from '@/lib/db';
import { recordOperationalEvent } from '@/lib/audit';

export interface ProfitsKPIs {
  platformGrossMarginFils: number;
  estimatedNetProfitFils: number;
  dueSalariesFils: number;
  proposedDistributionFils: number;
  totalPeriodPoolFils: number;
  distributableProfitFils: number;
  grossRevenueFils: number;
  supplierObligationsFils: number;
  courierCostsFils: number;
  deliveryRevenueFils?: number;
  deliveryProfitMarginFils?: number;
  operatingExpensesFils: number;
  accruedSalariesFils: number;
  paidSalariesFils: number;
  internalReserveFils: number;
  safeLiquidCashFils: number;
  partner1ShareFils: number;
  partner2ShareFils: number;
}

export interface ProfitSettings {
  reservePercentage: number;
  defaultCourierCostFils: number;
  defaultEmployeeWeeklyRateFils: number;
  defaultEmployeeWeeklyHours: number;
}

const DEFAULT_PROFIT_SETTINGS: ProfitSettings = {
  reservePercentage: 20,
  defaultCourierCostFils: 2000,
  defaultEmployeeWeeklyRateFils: 50000,
  defaultEmployeeWeeklyHours: 20,
};

export interface EmployeePayrollCard {
  employeeId: string;
  name: string;
  email: string;
  roleName: string;
  agreementId: string;
  payCycle: string;
  baseRateFils: number;
  contractType: string;
  weeklyAgreedHours: number;
  partnerSharePercentage?: number | null;
  notes?: string | null;
  currentPeriod: {
    id: string;
    reference: string;
    periodFrom: Date;
    periodTo: Date;
    grossAmountFils: number;
    deductionsFils: number;
    allowancesFils: number;
    netPayableFils: number;
    status: string; // ACCRUED, PAID
    paidAt?: Date | null;
    paymentReference?: string | null;
  };
  totalAccruedFils: number;
  totalPaidFils: number;
  dueBalanceFils: number;
}

export interface PartnerSummaryCard {
  ruleId: string;
  partnerName: string;
  sharePercentage: number;
  bankDetails: string | null;
  partnerEmployeeId?: string | null;
  linkedEmployeeName?: string | null;
  notes?: string | null;
  currentPeriodShareFils: number;
  totalApprovedDistributionsFils: number;
  totalPaidDistributionsFils: number;
  totalDrawingsOnAccountFils: number;
  totalAdminWagesFils: number;
  remainingDueFils: number;
}

export class ProfitsService {
  static async getProfitSettings(): Promise<ProfitSettings> {
    const row = await prisma.siteSettings.findUnique({ where: { key: 'profit_settings' } });
    if (!row) return DEFAULT_PROFIT_SETTINGS;

    try {
      const value = JSON.parse(row.value) as Partial<ProfitSettings>;
      const reservePercentage = Number(value.reservePercentage);
      const defaultCourierCostFils = Number(value.defaultCourierCostFils);
      const defaultEmployeeWeeklyRateFils = Number(value.defaultEmployeeWeeklyRateFils ?? DEFAULT_PROFIT_SETTINGS.defaultEmployeeWeeklyRateFils);
      const defaultEmployeeWeeklyHours = Number(value.defaultEmployeeWeeklyHours ?? DEFAULT_PROFIT_SETTINGS.defaultEmployeeWeeklyHours);
      if (!Number.isFinite(reservePercentage) || reservePercentage < 0 || reservePercentage > 100) {
        return DEFAULT_PROFIT_SETTINGS;
      }
      if (!Number.isInteger(defaultCourierCostFils) || defaultCourierCostFils < 0) {
        return DEFAULT_PROFIT_SETTINGS;
      }
      if (!Number.isInteger(defaultEmployeeWeeklyRateFils) || defaultEmployeeWeeklyRateFils <= 0) {
        return DEFAULT_PROFIT_SETTINGS;
      }
      if (!Number.isInteger(defaultEmployeeWeeklyHours) || defaultEmployeeWeeklyHours <= 0) {
        return DEFAULT_PROFIT_SETTINGS;
      }
      return { reservePercentage, defaultCourierCostFils, defaultEmployeeWeeklyRateFils, defaultEmployeeWeeklyHours };
    } catch {
      return DEFAULT_PROFIT_SETTINGS;
    }
  }

  static async updateProfitSettings(
    input: ProfitSettings,
    employeeId: string,
  ): Promise<ProfitSettings> {
    if (!Number.isFinite(input.reservePercentage) || input.reservePercentage < 0 || input.reservePercentage > 100) {
      throw new Error('نسبة الاحتياطي يجب أن تكون بين 0 و100%.');
    }
    if (!Number.isInteger(input.defaultCourierCostFils) || input.defaultCourierCostFils < 0 || input.defaultCourierCostFils > 1_000_000) {
      throw new Error('تكلفة التوصيل الافتراضية غير صحيحة.');
    }
    if (!Number.isInteger(input.defaultEmployeeWeeklyRateFils) || input.defaultEmployeeWeeklyRateFils <= 0 || input.defaultEmployeeWeeklyRateFils > 10_000_000) {
      throw new Error('الراتب الأسبوعي الافتراضي غير صحيح.');
    }
    if (!Number.isInteger(input.defaultEmployeeWeeklyHours) || input.defaultEmployeeWeeklyHours <= 0 || input.defaultEmployeeWeeklyHours > 168) {
      throw new Error('ساعات العمل الأسبوعية الافتراضية غير صحيحة.');
    }

    const key = 'profit_settings';
    const value: ProfitSettings = {
      reservePercentage: input.reservePercentage,
      defaultCourierCostFils: input.defaultCourierCostFils,
      defaultEmployeeWeeklyRateFils: input.defaultEmployeeWeeklyRateFils,
      defaultEmployeeWeeklyHours: input.defaultEmployeeWeeklyHours,
    };

    await prisma.$transaction(async (tx) => {
      const before = await tx.siteSettings.findUnique({ where: { key } });
      await tx.siteSettings.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      });
      await tx.auditLog.create({
        data: {
          employeeId,
          action: 'PROFIT_SETTINGS_UPDATED',
          entityType: 'SiteSettings',
          entityId: key,
          details: JSON.stringify({ before: before?.value || null, after: value }),
        },
      });
    });

    return value;
  }

  /**
   * 1. احتساب المؤشرات المالية الرئيسية (KPIs)
   */
  static async getProfitsKPIs(fromDate?: Date, toDate?: Date): Promise<ProfitsKPIs> {
    const profitSettings = await this.getProfitSettings();
    const periodFilter = fromDate || toDate ? {
      createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) },
    } : {};

    // 1. إيرادات الطلبات المسلمة فعلياً
    const deliveredOrders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        ...periodFilter,
      },
      select: {
        id: true,
        deliveryBatchId: true,
        totalAmount: true,
        actualDeliveryCost: true,
        shippingCost: true,
        deliveryAssignment: { select: { captainEarning: true } },
      },
    });

    const grossRevenueFils = deliveredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // 2. التزامات الموردين للأصناف المسلمة
    const deliveredItems = await prisma.orderItem.findMany({
      where: {
        order: { status: 'DELIVERED', ...periodFilter },
        supplierIdSnapshot: { not: null },
      },
      select: {
        unitCostSnapshot: true,
        quantity: true,
        supplierAmountSnapshot: true,
      },
    });

    const supplierObligationsFils = deliveredItems.reduce((acc, item) => {
      const cost = (item.unitCostSnapshot ?? 0) * item.quantity;
      const profit = item.supplierAmountSnapshot ?? 0;
      return acc + cost + profit;
    }, 0);

    // هامش نشاط رَواق (Platform Gross Margin)
    const platformGrossMarginFils = grossRevenueFils - supplierObligationsFils;

    // 3. تكاليف التوصيل وإيراداته (الزبون يدفع 3 د.أ افتراضياً، شركة التوصيل تستحق 2 د.أ، والفارق 1 د.أ ربح صاف للمنصة)
    const deliveryRevenueFils = deliveredOrders.reduce((sum, o) => sum + (o.shippingCost || 0), 0);
    const batchedOrders = new Map<string, typeof deliveredOrders>();
    let courierCostsFils = 0;
    for (const order of deliveredOrders) {
      if (!order.deliveryBatchId) courierCostsFils += order.actualDeliveryCost ?? profitSettings.defaultCourierCostFils;
      else batchedOrders.set(order.deliveryBatchId, [...(batchedOrders.get(order.deliveryBatchId) || []), order]);
    }
    if (batchedOrders.size) {
      const batches = await prisma.deliveryBatch.findMany({ where: { id: { in: [...batchedOrders.keys()] } }, select: { id: true, tariffEvaluatedAt: true, carrierTariffCostFils: true } });
      for (const batch of batches) {
        const orders = batchedOrders.get(batch.id) || [];
        courierCostsFils += batch.tariffEvaluatedAt
          ? (batch.carrierTariffCostFils ?? 0)
          : orders.reduce((sum, order) => sum + (order.actualDeliveryCost ?? profitSettings.defaultCourierCostFils), 0);
      }
    }
    const captainEarningsFils = deliveredOrders.reduce((sum, order) => sum + (order.deliveryAssignment?.captainEarning ?? 0), 0);
    const deliveryProfitMarginFils = deliveryRevenueFils - courierCostsFils - captainEarningsFils;

    // 4. المصاريف التشغيلية (تسويق، برمجيات، ضيافة...)
    const expenseDateFilter = fromDate || toDate ? {
      expenseDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) },
    } : {};

    const expensesAgg = await prisma.expense.aggregate({
      where: expenseDateFilter,
      _sum: { amount: true },
    });
    const operatingExpensesFils = expensesAgg._sum.amount || 0;

    // 5. رواتب الموظفين (المستحقة والمدفوعة)
    const payrollFilter = fromDate || toDate ? {
      ...(toDate ? { periodFrom: { lte: toDate } } : {}),
      ...(fromDate ? { periodTo: { gte: fromDate } } : {}),
    } : {};

    const [accruedSalariesAgg, paidSalariesAgg] = await Promise.all([
      prisma.payrollPeriod.aggregate({
        where: { status: { in: ['ACCRUED', 'PAID'] }, ...payrollFilter },
        _sum: { netPayableFils: true },
      }),
      prisma.payrollPayment.aggregate({
        where: fromDate || toDate ? { paidAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {},
        _sum: { amountFils: true },
      }),
    ]);

    const accruedSalariesFils = accruedSalariesAgg._sum.netPayableFils || 0;
    const paidSalariesFils = paidSalariesAgg._sum.amountFils || 0;
    const dueSalariesFils = Math.max(0, accruedSalariesFils - paidSalariesFils);

    // 6. صافي الربح المحاسبي
    const estimatedNetProfitFils =
      platformGrossMarginFils - courierCostsFils - captainEarningsFils - operatingExpensesFils - accruedSalariesFils;

    // 7. الاحتياطي التشغيلي الداخلي حسب إعدادات DB
    const internalReserveFils =
      estimatedNetProfitFils > 0 ? Math.round(estimatedNetProfitFils * (profitSettings.reservePercentage / 100)) : 0;

    // 8. الربح القابل للتوزيع دفترياً
    const distributableProfitFils = Math.max(0, estimatedNetProfitFils - internalReserveFils);

    // 9. فحص السيولة النقدية الحرة الآمنة وسحوبات الشركاء
    // النقد المحصل فعلياً لخزينة رَواق مطروحاً منه استحقاقات الموردين ومصاريف التشغيل والرواتب
    const payoutFilter = fromDate || toDate ? {
      paidAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) },
    } : {};

    const [liabilityGroups, fundBalances, totalAccruedPayrollAgg, totalPaidPayrollAgg, partnerRules] = await Promise.all([
      prisma.financialTransaction.groupBy({
        by: ['type'],
        where: { type: { in: [
          'SUPPLIER_OBLIGATION', 'SUPPLIER_OBLIGATION_REVERSAL', 'SUPPLIER_PAYMENT', 'SUPPLIER_PAYMENT_REVERSAL',
          'CAPTAIN_EARNING', 'CAPTAIN_EARNING_REVERSAL', 'CAPTAIN_PAYMENT', 'CAPTAIN_PAYMENT_REVERSAL',
        ] } },
        _sum: { amount: true },
      }),
      this.getFundBalances(),
      prisma.payrollPeriod.aggregate({ where: { status: { in: ['ACCRUED', 'PAID'] } }, _sum: { netPayableFils: true } }),
      prisma.payrollPayment.aggregate({ _sum: { amountFils: true } }),
      prisma.partnerShareRule.findMany({
        where: { isActive: true },
        include: {
          payouts: {
            where: payoutFilter,
          },
        },
      }),
    ]);

    const liabilityByType = new Map(liabilityGroups.map(group => [group.type, group._sum.amount ?? 0]));
    const liability = (type: string) => liabilityByType.get(type) ?? 0;
    const supplierDueFils = Math.max(0, liability('SUPPLIER_OBLIGATION') - liability('SUPPLIER_OBLIGATION_REVERSAL') - liability('SUPPLIER_PAYMENT') + liability('SUPPLIER_PAYMENT_REVERSAL'));
    const captainDueFils = Math.max(0, liability('CAPTAIN_EARNING') - liability('CAPTAIN_EARNING_REVERSAL') - liability('CAPTAIN_PAYMENT') + liability('CAPTAIN_PAYMENT_REVERSAL'));
    const allDueSalariesFils = Math.max(0, (totalAccruedPayrollAgg._sum.netPayableFils ?? 0) - (totalPaidPayrollAgg._sum.amountFils ?? 0));

    // السيولة الحرة = الرصيد الفعلي للصندوق والبنك بعد حجز التزامات الموردين والمندوبين والرواتب القائمة.
    const safeLiquidCashFils = Math.max(0, fundBalances.bankFils + fundBalances.cashFils - supplierDueFils - captainDueFils - allDueSalariesFils);

    // إجمالي وعاء أرباح الفترة المتاح للتوزيع بين الشركاء (مقيداً بالسيولة التشغيلية الكلية للمنصة):
    const totalPeriodPoolFils = Math.min(
      distributableProfitFils,
      safeLiquidCashFils
    );

    // حساب استحقاقات كل شريك من وعاء أرباح الفترة مطروحاً منها مسحوباته الفردية:
    let partner1ShareFils = 0;
    let partner2ShareFils = 0;
    let totalUnpaidPartnerSharesFils = 0;

    const p1Rule = partnerRules[0];
    const p2Rule = partnerRules[1];

    if (p1Rule) {
      const p1GrossShare = Math.floor(totalPeriodPoolFils * (p1Rule.sharePercentage / 100));
      const p1Paid = p1Rule.payouts.reduce((sum, p) => sum + p.amountFils, 0);
      partner1ShareFils = Math.max(0, p1GrossShare - p1Paid);
      totalUnpaidPartnerSharesFils += partner1ShareFils;
    }

    if (p2Rule) {
      const p2GrossShare = Math.floor(totalPeriodPoolFils * (p2Rule.sharePercentage / 100));
      const p2Paid = p2Rule.payouts.reduce((sum, p) => sum + p.amountFils, 0);
      partner2ShareFils = Math.max(0, p2GrossShare - p2Paid);
      totalUnpaidPartnerSharesFils += partner2ShareFils;
    }

    // الأرباح المقترحة للتوزيع: صافي المستحقات المتبقية غير المصروفة للشركاء ومقيدة بالسيولة الفعلية بالخزينة
    const proposedDistributionFils = Math.min(safeLiquidCashFils, totalUnpaidPartnerSharesFils);

    return {
      platformGrossMarginFils,
      estimatedNetProfitFils,
      dueSalariesFils,
      proposedDistributionFils,
      totalPeriodPoolFils,
      distributableProfitFils,
      grossRevenueFils,
      supplierObligationsFils,
      courierCostsFils,
      deliveryRevenueFils,
      deliveryProfitMarginFils,
      operatingExpensesFils,
      accruedSalariesFils,
      paidSalariesFils,
      internalReserveFils,
      safeLiquidCashFils,
      partner1ShareFils,
      partner2ShareFils,
    };
  }

  /**
   * 2. إدارة رواتب الموظفين مع اتفاقيات العمل والأسبوع الجاري
   */
  static async getEmployeePayrollList(): Promise<EmployeePayrollCard[]> {
    const [employees, partnerRules, profitSettings] = await Promise.all([
      prisma.employee.findMany({
        where: { isActive: true },
        include: {
          role: true,
          payAgreements: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          payrollPeriods: {
            orderBy: { periodFrom: 'desc' },
            include: { payment: true },
          },
        },
      }),
      prisma.partnerShareRule.findMany({
        where: { isActive: true },
      }),
      this.getProfitSettings(),
    ]);

    const now = new Date();
    // حساب بداية ونهاية الأسبوع الحالي (الإثنين إلى الأحد)
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - distanceToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    const cards: EmployeePayrollCard[] = [];

    for (const emp of employees) {
      // إذا لم يكن لدى الموظف اتفاقية راتب سابقة، ننشئها من إعدادات الأرباح المحفوظة في DB
      let agreement = emp.payAgreements[0];
      if (!agreement) {
        agreement = await prisma.employeePayAgreement.create({
          data: {
            employeeId: emp.id,
            payCycle: 'WEEKLY',
            baseRateFils: profitSettings.defaultEmployeeWeeklyRateFils,
            currency: 'JOD',
            contractType: 'PART_TIME',
            weeklyAgreedHours: profitSettings.defaultEmployeeWeeklyHours,
            notes: 'الاتفاقية الافتراضية المعتمدة من إعدادات الأرباح',
          },
        });
      }

      // فحص إذا كان الموظف شريكاً أيضاً في المنصة
      const linkedPartner = partnerRules.find((r) => r.partnerEmployeeId === emp.id);

      // البحث عن فترة الأسبوع الحالي أو إنشاؤها تلقائياً كاستحقاق (Accrual)
      let currentPeriod = emp.payrollPeriods.find(
        (p) =>
          new Date(p.periodFrom).getTime() <= now.getTime() &&
          new Date(p.periodTo).getTime() >= now.getTime()
      );

      if (!currentPeriod) {
        const weekNum = Math.ceil((now.getDate() + 6 - now.getDay()) / 7);
        const ref = `PAYROLL-${now.getFullYear()}-W${weekNum}-${emp.name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        currentPeriod = await prisma.payrollPeriod.create({
          data: {
            reference: ref,
            employeeId: emp.id,
            agreementId: agreement.id,
            periodFrom: currentWeekStart,
            periodTo: currentWeekEnd,
            grossAmountFils: agreement.baseRateFils,
            deductionsFils: 0,
            allowancesFils: 0,
            netPayableFils: agreement.baseRateFils,
            status: 'ACCRUED',
            notes: `استحقاق أسبوعي للأسبوع الحالي`,
          },
          include: { payment: true },
        });
      }

      const totalAccruedFils = emp.payrollPeriods.reduce(
        (sum, p) => sum + (p.status !== 'CANCELLED' ? p.netPayableFils : 0),
        0
      );
      const totalPaidFils = emp.payrollPeriods.reduce(
        (sum, p) => sum + (p.status === 'PAID' && p.payment ? p.payment.amountFils : 0),
        0
      );
      const dueBalanceFils = Math.max(0, totalAccruedFils - totalPaidFils);

      cards.push({
        employeeId: emp.id,
        name: emp.name,
        email: emp.email,
        roleName: emp.role?.name || 'موظف',
        agreementId: agreement.id,
        payCycle: agreement.payCycle,
        baseRateFils: agreement.baseRateFils,
        contractType: agreement.contractType,
        weeklyAgreedHours: agreement.weeklyAgreedHours ?? profitSettings.defaultEmployeeWeeklyHours,
        partnerSharePercentage: linkedPartner ? linkedPartner.sharePercentage : null,
        notes: agreement.notes,
        currentPeriod: {
          id: currentPeriod.id,
          reference: currentPeriod.reference,
          periodFrom: currentPeriod.periodFrom,
          periodTo: currentPeriod.periodTo,
          grossAmountFils: currentPeriod.grossAmountFils,
          deductionsFils: currentPeriod.deductionsFils,
          allowancesFils: currentPeriod.allowancesFils,
          netPayableFils: currentPeriod.netPayableFils,
          status: currentPeriod.status,
          paidAt: currentPeriod.payment?.paidAt || null,
          paymentReference: currentPeriod.payment?.paymentReference || null,
        },
        totalAccruedFils,
        totalPaidFils,
        dueBalanceFils,
      });
    }

    return cards;
  }

  /**
   * تعديل أو تحديث اتفاقية راتب الموظف (الأجر وساعات العمل والنوع)
   */
  static async updateEmployeePayAgreement(
    employeeId: string,
    input: {
      baseRateFils: number;
      contractType: string;
      weeklyAgreedHours: number;
      notes?: string;
    },
    adminEmployeeId: string,
    adminName: string
  ) {
    if (input.baseRateFils <= 0) {
      throw new Error('قيمة الراتب يجب أن تكون أكبر من صفر.');
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        payAgreements: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!employee) throw new Error('الموظف غير موجود.');

    return await prisma.$transaction(async (tx) => {
      const currentAgreement = employee.payAgreements[0];
      let agreement;
      if (currentAgreement) {
        agreement = await tx.employeePayAgreement.update({
          where: { id: currentAgreement.id },
          data: {
            baseRateFils: input.baseRateFils,
            contractType: input.contractType,
            weeklyAgreedHours: input.weeklyAgreedHours,
            notes: input.notes || null,
          },
        });
      } else {
        agreement = await tx.employeePayAgreement.create({
          data: {
            employeeId,
            payCycle: 'WEEKLY',
            baseRateFils: input.baseRateFils,
            contractType: input.contractType,
            weeklyAgreedHours: input.weeklyAgreedHours,
            notes: input.notes || null,
            createdByEmployeeId: adminEmployeeId,
          },
        });
      }

      // تحديث قيمة فترة الاستحقاق الحالية غير المسددة لتعكس الراتب الجديد فوراً
      const pendingPeriods = await tx.payrollPeriod.findMany({
        where: {
          employeeId,
          status: 'ACCRUED',
        },
      });

      for (const p of pendingPeriods) {
        const net = Math.max(0, input.baseRateFils - p.deductionsFils + p.allowancesFils);
        await tx.payrollPeriod.update({
          where: { id: p.id },
          data: {
            grossAmountFils: input.baseRateFils,
            netPayableFils: net,
            notes: `تم تحديث قيمة الاستحقاق بناءً على تعديل الراتب التعاقدي إلى ${(input.baseRateFils / 1000).toFixed(3)} د.أ`,
          },
        });
      }

      await recordOperationalEvent({
        employeeId: adminEmployeeId,
        action: 'UPDATE_EMPLOYEE_PAY_AGREEMENT',
        entityType: 'EMPLOYEE_PAY_AGREEMENT',
        entityId: agreement.id,
        category: 'ACCOUNTING',
        outcome: 'SUCCESS',
        details: {
          employeeName: employee.name,
          baseRateFils: input.baseRateFils,
          contractType: input.contractType,
          weeklyAgreedHours: input.weeklyAgreedHours,
          updatedBy: adminName,
        },
      });

      return agreement;
    });
  }

  /**
   * 3. صرف وسداد راتب الموظف مع منع التكرار (Idempotent Disbursement)
   */
  static async disburseSalaryPayment(
    payrollPeriodId: string,
    input: {
      amountFils?: number;
      paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CLIK';
      paymentReference?: string;
      notes?: string;
    },
    adminEmployeeId: string,
    adminEmployeeName: string
  ) {
    const period = await prisma.payrollPeriod.findUnique({
      where: { id: payrollPeriodId },
      include: { employee: true, payment: true },
    });

    if (!period) throw new Error('فترة الراتب غير موجودة.');
    if (period.status === 'PAID' || period.payment) {
      throw new Error('تم سداد راتب هذا الأسبوع مسبقاً ولا يجوز الصرف مرتين.');
    }

    if (period.netPayableFils <= 0 || (input.amountFils !== undefined && input.amountFils !== period.netPayableFils)) {
      throw new Error('مبلغ الراتب غير صالح؛ يجب سداد كامل الاستحقاق المسجل للفترة.');
    }

    const payAmount = period.netPayableFils;
    const idempotencyKey = `payroll-payout:${period.id}`;
    const paymentRef = `PAY-${period.reference}-${Date.now().toString().slice(-4)}`;

    return await prisma.$transaction(async (tx) => {
      // 1. تسجيل قيد مالي في الدفتر المركزي
      const finTx = await tx.financialTransaction.create({
        data: {
          type: 'SALARY_PAYMENT',
          direction: 'OUT',
          amount: payAmount,
          fundAccount: input.paymentMethod === 'CASH' ? 'CASH' : 'BANK',
          paymentMethod: input.paymentMethod,
          counterpartyName: period.employee.name,
          businessEventKey: idempotencyKey,
          description: `سداد راتب الموظف ${period.employee.name} للفترة ${period.reference}`,
          createdByEmployeeId: adminEmployeeId,
        },
      });

      // 2. تسجيل دفعة الرواتب
      const payment = await tx.payrollPayment.create({
        data: {
          reference: paymentRef,
          payrollPeriodId: period.id,
          amountFils: payAmount,
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference || null,
          paidByEmployeeId: adminEmployeeId,
          idempotencyKey,
          notes: input.notes || null,
          financialTxId: finTx.id,
        },
      });

      // 3. تحديث حالة فترة الراتب إلى PAID
      await tx.payrollPeriod.update({
        where: { id: period.id },
        data: { status: 'PAID' },
      });

      // 4. توثيق سجل التدقيق
      await recordOperationalEvent({
        employeeId: adminEmployeeId,
        action: 'DISBURSE_PAYROLL',
        entityType: 'PAYROLL_PAYMENT',
        entityId: payment.id,
        category: 'ACCOUNTING',
        outcome: 'SUCCESS',
        details: {
          employeeName: period.employee.name,
          periodReference: period.reference,
          amountFils: payAmount,
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference,
        },
      });

      return payment;
    });
  }

  /**
   * 4. إدارة الشركاء ونسب الملكية
   */
  static async getPartnersSummary(fromDate?: Date, toDate?: Date): Promise<PartnerSummaryCard[]> {
    const payoutFilter = fromDate && toDate ? {
      paidAt: { gte: fromDate, lte: toDate },
    } : {};

    const [rulesFound, employees, kpis] = await Promise.all([
      prisma.partnerShareRule.findMany({
        where: { isActive: true },
        include: {
          payouts: {
            where: payoutFilter,
            orderBy: { paidAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
      }),
      this.getProfitsKPIs(fromDate, toDate),
    ]);

    let rules = rulesFound;

    // إذا لم تكن قواعد الشركاء معرفة، ننشئ الشريك الأول والشريك الثاني تلقائياً (50/50)
    if (rules.length === 0) {
      const p1 = await prisma.partnerShareRule.create({
        data: {
          partnerName: 'الشريك الأول',
          sharePercentage: 50,
          notes: 'حصة ملكية 50% من أرباح رَواق المعتمدة',
        },
        include: { payouts: true },
      });
      const p2 = await prisma.partnerShareRule.create({
        data: {
          partnerName: 'الشريك الثاني',
          sharePercentage: 50,
          notes: 'حصة ملكية 50% من أرباح رَواق المعتمدة',
        },
        include: { payouts: true },
      });
      rules = [p1, p2];
    }

    // استخراج إجمالي التوزيعات المعتمدة من الفترات المالية المغلقة
    const approvedDistributions = await prisma.profitDistribution.findMany({
      where: {
        profitClose: {
          status: { in: ['APPROVED', 'CLOSED'] },
          ...(fromDate && toDate
            ? {
                OR: [
                  { closedAt: { gte: fromDate, lte: toDate } },
                  { closedAt: null, createdAt: { gte: fromDate, lte: toDate } },
                ],
              }
            : {}),
        },
      },
    });

    const totalApprovedDistributions = approvedDistributions.reduce(
      (sum, d) => sum + d.totalDistributedFils,
      0
    );

    return rules.map((r) => {
      // 1. حصة الشريك من وعاء أرباح الفترة الجارية (وفق نسبة ملكيته قبل سحوباته الفردية)
      const currentPeriodShareFils = Math.floor(
        kpis.totalPeriodPoolFils * (r.sharePercentage / 100)
      );

      // 2. حصة الشريك المعتمدة من الإغلاقات السابقة
      const totalApprovedDistributionsFils = Math.floor(
        totalApprovedDistributions * (r.sharePercentage / 100)
      );

      // 3. إجمالي الاستحقاق المالي المخصص للشريك (الفترة الجارية المتاحة + المعتمد من الفترات السابقة)
      const totalEligibleFils = totalApprovedDistributionsFils + currentPeriodShareFils;

      // 4. المسحوبات الفعلية المصروفة للشريك
      const totalPaidDistributionsFils = r.payouts
        .filter((p) => p.payoutType === 'PROFIT_DISTRIBUTION')
        .reduce((sum, p) => sum + p.amountFils, 0);

      const totalDrawingsOnAccountFils = r.payouts
        .filter((p) => p.payoutType === 'DRAWING_ON_ACCOUNT')
        .reduce((sum, p) => sum + p.amountFils, 0);

      const totalAdminWagesFils = r.payouts
        .filter((p) => p.payoutType === 'ADMINISTRATIVE_WAGE')
        .reduce((sum, p) => sum + p.amountFils, 0);

      const totalDrawnFils = totalPaidDistributionsFils + totalDrawingsOnAccountFils;

      // 5. الرصيد الصافي المتبقي المستحق للصرف للشريك (مقيداً بسقف السيولة المتاحة فعلياً في الخزينة)
      const bookRemainingFils = Math.max(0, totalEligibleFils - totalDrawnFils);
      const remainingDueFils = Math.min(kpis.safeLiquidCashFils, bookRemainingFils);

      const linkedEmp = r.partnerEmployeeId
        ? employees.find((e) => e.id === r.partnerEmployeeId)
        : null;

      return {
        ruleId: r.id,
        partnerName: r.partnerName,
        sharePercentage: r.sharePercentage,
        bankDetails: r.bankDetails,
        partnerEmployeeId: r.partnerEmployeeId,
        linkedEmployeeName: linkedEmp?.name || null,
        notes: r.notes,
        currentPeriodShareFils,
        totalApprovedDistributionsFils,
        totalPaidDistributionsFils,
        totalDrawingsOnAccountFils,
        totalAdminWagesFils,
        remainingDueFils,
      };
    });
  }

  /**
   * تعديل وحفظ نسب الشركاء وربطهم بالموظفين (مع فحص مجموع النسب = 100%)
   */
  static async updatePartnerShareRules(
    rules: Array<{
      id?: string;
      partnerName: string;
      sharePercentage: number;
      partnerEmployeeId?: string | null;
      bankDetails?: string | null;
      notes?: string | null;
      isActive?: boolean;
    }>,
    adminEmployeeId: string,
    adminName: string
  ) {
    const activeRules = rules.filter((r) => r.isActive !== false);
    const totalPercentage = activeRules.reduce((sum, r) => sum + r.sharePercentage, 0);

    if (totalPercentage !== 100) {
      throw new Error(`مجموع نسب الشركاء يجب أن يساوي 100% تماماً. المجموع الحالي: ${totalPercentage}%`);
    }

    return await prisma.$transaction(async (tx) => {
      const results = [];

      for (const r of rules) {
        if (r.id) {
          const updated = await tx.partnerShareRule.update({
            where: { id: r.id },
            data: {
              partnerName: r.partnerName,
              sharePercentage: r.sharePercentage,
              partnerEmployeeId: r.partnerEmployeeId || null,
              bankDetails: r.bankDetails || null,
              notes: r.notes || null,
              isActive: r.isActive !== false,
            },
          });
          results.push(updated);
        } else {
          const created = await tx.partnerShareRule.create({
            data: {
              partnerName: r.partnerName,
              sharePercentage: r.sharePercentage,
              partnerEmployeeId: r.partnerEmployeeId || null,
              bankDetails: r.bankDetails || null,
              notes: r.notes || null,
              isActive: r.isActive !== false,
            },
          });
          results.push(created);
        }
      }

      await recordOperationalEvent({
        employeeId: adminEmployeeId,
        action: 'UPDATE_PARTNER_SHARE_RULES',
        entityType: 'PARTNER_SHARE_RULE',
        entityId: 'ALL_RULES',
        category: 'ACCOUNTING',
        outcome: 'SUCCESS',
        details: {
          partnersCount: rules.length,
          rulesSummary: rules.map((r) => ({
            name: r.partnerName,
            share: `${r.sharePercentage}%`,
            linkedEmployeeId: r.partnerEmployeeId,
          })),
          updatedBy: adminName,
        },
      });

      return results;
    });
  }

  /**
   * 5. صرف دفعة لأحد الشركاء (توزيع أرباح أو سحب على الحساب أو أجر إداري)
   */
  static async disbursePartnerPayout(
    partnerRuleId: string,
    input: {
      amountFils: number;
      payoutType: 'PROFIT_DISTRIBUTION' | 'DRAWING_ON_ACCOUNT' | 'ADMINISTRATIVE_WAGE';
      paymentMethod: string;
      paymentReference?: string;
      notes?: string;
    },
    adminEmployeeId: string,
    adminEmployeeName: string
  ) {
    if (input.amountFils <= 0) throw new Error('مبلغ الصرف يجب أن يكون أكبر من صفر.');

    return await prisma.$transaction(async (tx) => {
      // Serialize partner payouts so two simultaneous requests cannot spend the same free balance.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('rwaq-partner-payout'))`;
      const partner = await tx.partnerShareRule.findUnique({ where: { id: partnerRuleId } });
      if (!partner) throw new Error('الشريك غير مسجل.');

      const partnersSummary = await this.getPartnersSummary();
      const partnerCard = partnersSummary.find((p) => p.ruleId === partnerRuleId);
      if (!partnerCard) throw new Error('بيانات الحساب المالي للشريك غير متوفرة.');
      if (input.amountFils > partnerCard.remainingDueFils) {
        throw new Error(
          `المبلغ المطلوب (${(input.amountFils / 1000).toFixed(3)} د.أ) يتجاوز الرصيد المستحق للشريك (${(partnerCard.remainingDueFils / 1000).toFixed(3)} د.أ). يمنع النظام صرف مبالغ تتجاوز حصة الشريك المقررة لمنع أي ذمم أو تناقضات مالية.`
        );
      }

      const idempotencyKey = `partner-payout:${partner.id}:${Date.now()}`;
      const ref = `POUT-${partner.partnerName === 'الشريك الأول' ? 'P1' : 'P2'}-${Date.now().toString().slice(-5)}`;
      // 1. تسجيل قيد مالي في الدفتر المركزي
      const finTx = await tx.financialTransaction.create({
        data: {
          type:
            input.payoutType === 'PROFIT_DISTRIBUTION'
              ? 'PARTNER_DISTRIBUTION_PAYOUT'
              : input.payoutType === 'DRAWING_ON_ACCOUNT'
              ? 'PARTNER_DRAWING'
              : 'ADMINISTRATIVE_EXPENSE',
          direction: 'OUT',
          amount: input.amountFils,
          fundAccount: input.paymentMethod === 'CASH' ? 'CASH' : 'BANK',
          paymentMethod: input.paymentMethod,
          counterpartyName: partner.partnerName,
          businessEventKey: idempotencyKey,
          description: `صرف ${
            input.payoutType === 'PROFIT_DISTRIBUTION'
              ? 'توزيع أرباح'
              : input.payoutType === 'DRAWING_ON_ACCOUNT'
              ? 'سحب على الحساب'
              : 'أجر إداري'
          } لصالح ${partner.partnerName}`,
          createdByEmployeeId: adminEmployeeId,
        },
      });

      // 2. تسجيل دفعة الشريك
      const payout = await tx.partnerPayout.create({
        data: {
          reference: ref,
          partnerRuleId: partner.id,
          payoutType: input.payoutType,
          amountFils: input.amountFils,
          paymentMethod: input.paymentMethod || 'BANK_TRANSFER',
          paymentReference: input.paymentReference || null,
          authorizedByAdmin: adminEmployeeName,
          idempotencyKey,
          notes: input.notes || null,
          financialTxId: finTx.id,
        },
      });

      // 3. توثيق سجل التدقيق
      await recordOperationalEvent({
        employeeId: adminEmployeeId,
        action: 'DISBURSE_PARTNER_PAYOUT',
        entityType: 'PARTNER_PAYOUT',
        entityId: payout.id,
        category: 'ACCOUNTING',
        outcome: 'SUCCESS',
        details: {
          partnerName: partner.partnerName,
          payoutType: input.payoutType,
          amountFils: input.amountFils,
          paymentReference: input.paymentReference,
        },
      });

      return payout;
    }, { isolationLevel: 'Serializable' });
  }

  /**
   * 6. معالج إغلاق الفترة المالية واعتماد توزيع الأرباح (Dual Approval)
   */
  static async createPeriodCloseDraft(
    periodFrom: Date,
    periodTo: Date,
    adminEmployeeId: string,
    notes?: string
  ) {
    const [kpis, profitSettings] = await Promise.all([
      this.getProfitsKPIs(periodFrom, periodTo),
      this.getProfitSettings(),
    ]);
    const ref = `PCLOSE-${periodFrom.getFullYear()}-${(periodFrom.getMonth() + 1).toString().padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    return await prisma.profitClose.create({
      data: {
        reference: ref,
        periodFrom,
        periodTo,
        grossRevenueFils: kpis.grossRevenueFils,
        supplierObligationsFils: kpis.supplierObligationsFils,
        platformGrossMarginFils: kpis.platformGrossMarginFils,
        courierCostsFils: kpis.courierCostsFils,
        operatingExpensesFils: kpis.operatingExpensesFils,
        staffSalariesFils: kpis.accruedSalariesFils,
        netProfitFils: kpis.estimatedNetProfitFils,
        reservePercentage: profitSettings.reservePercentage,
        internalReserveFils: kpis.internalReserveFils,
        distributableProfitFils: kpis.distributableProfitFils,
        safeLiquidCashFils: kpis.safeLiquidCashFils,
        actualApprovedDistributionFils: kpis.proposedDistributionFils,
        status: 'DRAFT',
        notes: notes || 'مسودة إغلاق الفترة المالية لمراجعة واعتماد الشريكين',
        closedByEmployeeId: adminEmployeeId,
      },
    });
  }

  /**
   * اعتماد الإغلاق من أحد الشريكين (Dual Approval Guard)
   */
  static async approvePeriodCloseByPartner(
    closeId: string,
    partnerNumber: 1 | 2,
    adminEmployeeId: string,
    adminName: string
  ) {
    const close = await prisma.profitClose.findUnique({
      where: { id: closeId },
    });
    if (!close) throw new Error('سجل الإغلاق المالي غير موجود.');

    const updateData: any = {};
    if (partnerNumber === 1) {
      updateData.partner1Approved = true;
      updateData.partner1ApprovedAt = new Date();
      updateData.partner1EmployeeId = adminEmployeeId;
    } else {
      updateData.partner2Approved = true;
      updateData.partner2ApprovedAt = new Date();
      updateData.partner2EmployeeId = adminEmployeeId;
    }

    const isFullyApproved =
      (partnerNumber === 1 ? true : close.partner1Approved) &&
      (partnerNumber === 2 ? true : close.partner2Approved);

    if (isFullyApproved) {
      updateData.status = 'APPROVED';
      updateData.closedAt = new Date();
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.profitClose.update({
        where: { id: closeId },
        data: updateData,
      });

      // إذا اكتملت موافقة الشريكين معاً، يتم إنشاء قيد توزيع الأرباح 50/50
      if (isFullyApproved && close.actualApprovedDistributionFils > 0) {
        const p1Amount = Math.floor(close.actualApprovedDistributionFils * 0.5);
        const p2Amount = close.actualApprovedDistributionFils - p1Amount;

        await tx.profitDistribution.create({
          data: {
            reference: `DISTRIB-${close.reference}`,
            profitCloseId: close.id,
            totalDistributedFils: close.actualApprovedDistributionFils,
            partner1AmountFils: p1Amount,
            partner2AmountFils: p2Amount,
            status: 'PENDING_PAYOUT',
          },
        });
      }

      await recordOperationalEvent({
        employeeId: adminEmployeeId,
        action: 'APPROVE_PROFIT_CLOSE',
        entityType: 'PROFIT_CLOSE',
        entityId: close.id,
        category: 'ACCOUNTING',
        outcome: 'SUCCESS',
        details: {
          partnerNumber,
          approvedBy: adminName,
          isFullyApproved,
          reference: close.reference,
        },
      });

      return updated;
    });
  }

  /**
   * 7. سجل القيود التاريخي المتكامل (Full Ledger)
   */
  static async getFundBalances() {
    const rows = await prisma.financialTransaction.findMany({
      where: { fundAccount: { in: ['BANK', 'CASH'] } },
      select: { fundAccount: true, transferToFundAccount: true, direction: true, amount: true },
    });
    const balances = { bankFils: 0, cashFils: 0 };
    for (const row of rows) {
      const source = row.fundAccount === 'BANK' ? 'bankFils' : 'cashFils';
      if (row.direction === 'IN') balances[source] += row.amount;
      if (row.direction === 'OUT') balances[source] -= row.amount;
      if (row.direction === 'TRANSFER' && row.transferToFundAccount) {
        balances[source] -= row.amount;
        if (row.transferToFundAccount === 'BANK') balances.bankFils += row.amount;
        if (row.transferToFundAccount === 'CASH') balances.cashFils += row.amount;
      }
    }
    return balances;
  }

  static async getProfitsFullLedger(limit = 500, fromDate?: Date, toDate?: Date, receiverId?: string, paymentMethod?: string) {
    const movementTypes = [
      'COD_SETTLEMENT', 'COD_SETTLEMENT_REVERSAL',
      'SUPPLIER_PAYMENT', 'SUPPLIER_PAYMENT_REVERSAL',
      'CAPTAIN_PAYMENT', 'CAPTAIN_PAYMENT_REVERSAL',
      'EXPENSE', 'SALARY_PAYMENT', 'PARTNER_DISTRIBUTION_PAYOUT', 'PARTNER_DRAWING',
      'ADMINISTRATIVE_EXPENSE', 'CASH_DEPOSIT', 'BANK_OPENING_BALANCE', 'CASH_OPENING_BALANCE',
      'REFUND', 'REFUND_PRODUCT', 'REFUND_DELIVERY', 'REFUND_TAX',
    ];
    const where: any = { type: { in: movementTypes } };
    if (fromDate || toDate) where.createdAt = { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) };
    if (receiverId) where.receivedByEmployeeId = receiverId;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    const transactions = await prisma.financialTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.max(1, Math.min(limit, 1000)) });
    const ids = transactions.map(t => t.id);
    const supplierIds = [...new Set(transactions.map(t => t.supplierId).filter(Boolean))] as string[];
    const captainIds = [...new Set(transactions.map(t => t.captainId).filter(Boolean))] as string[];
    const [suppliers, captains, expenses, salaryPayments, partnerPayouts, supplierSettlements] = ids.length ? await Promise.all([
      supplierIds.length ? prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      captainIds.length ? prisma.captain.findMany({ where: { id: { in: captainIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      prisma.expense.findMany({ where: { financialTransactionId: { in: ids } }, select: { financialTransactionId: true, reference: true, category: true } }),
      prisma.payrollPayment.findMany({ where: { financialTxId: { in: ids } }, select: { financialTxId: true, reference: true, payrollPeriod: { select: { employee: { select: { name: true } } } } } }),
      prisma.partnerPayout.findMany({ where: { financialTxId: { in: ids } }, select: { financialTxId: true, reference: true, partnerRule: { select: { partnerName: true } } } }),
      prisma.supplierSettlement.findMany({ where: { financialTransactionId: { in: ids } }, select: { financialTransactionId: true, reference: true } }),
    ]) : [[], [], [], [], [], []];
    const supplierNames = new Map(suppliers.map(s => [s.id, s.name]));
    const captainNames = new Map(captains.map(c => [c.id, c.name]));
    const expenseByTx = new Map(expenses.filter(e => e.financialTransactionId).map(e => [e.financialTransactionId!, e]));
    const salaryByTx = new Map(salaryPayments.map(p => [p.financialTxId, p]));
    const partnerByTx = new Map(partnerPayouts.map(p => [p.financialTxId, p]));
    const supplierPaymentByTx = new Map(supplierSettlements.map(s => [s.financialTransactionId, s]));
    const employeeIds = [...new Set(transactions.flatMap(t => [t.createdByEmployeeId, t.receivedByEmployeeId]).filter(Boolean))] as string[];
    const employees = employeeIds.length ? await prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true } }) : [];
    const employeeNames = new Map(employees.map(e => [e.id, e.name]));
    const labels: Record<string, string> = {
      COD_SETTLEMENT: 'توريد من شركة التوصيل', SUPPLIER_PAYMENT: 'دفعة مورد', SUPPLIER_PAYMENT_REVERSAL: 'عكس دفعة مورد',
      COD_SETTLEMENT_REVERSAL: 'عكس توريد شركة التوصيل', CAPTAIN_PAYMENT: 'دفعة مندوب التوصيل', CAPTAIN_PAYMENT_REVERSAL: 'عكس دفعة مندوب', EXPENSE: 'مصروف',
      SALARY_PAYMENT: 'سداد راتب', PARTNER_DISTRIBUTION_PAYOUT: 'توزيع أرباح شريك', PARTNER_DRAWING: 'سحب شريك',
      ADMINISTRATIVE_EXPENSE: 'أجر إداري لشريك', CASH_DEPOSIT: 'إيداع نقدي في البنك', BANK_OPENING_BALANCE: 'رصيد افتتاحي للبنك', CASH_OPENING_BALANCE: 'رصيد افتتاحي للصندوق',
      REFUND: 'مبلغ مسترد', REFUND_PRODUCT: 'استرداد قيمة منتجات', REFUND_DELIVERY: 'استرداد رسوم توصيل', REFUND_TAX: 'استرداد ضريبة',
    };
    return transactions.map(t => {
      const expense = expenseByTx.get(t.id);
      const salary = salaryByTx.get(t.id);
      const partner = partnerByTx.get(t.id);
      const supplierSettlement = supplierPaymentByTx.get(t.id);
      const batchReference = t.description.match(/طلبية\s+([^\s\[]+)/)?.[1];
      const referencePrefix = t.type.includes('SUPPLIER') ? 'SHOP' : t.type.includes('CAPTAIN') ? 'COURIER' : t.type.includes('SALARY') ? 'PAY' : t.type.includes('PARTNER') || t.type === 'ADMINISTRATIVE_EXPENSE' ? 'PARTNER' : t.type.includes('COD_SETTLEMENT') ? 'COD' : t.type === 'EXPENSE' ? 'EXP' : t.type.replaceAll('_', '-');
      const reference = expense?.reference || salary?.reference || partner?.reference || supplierSettlement?.reference || batchReference || `${referencePrefix}-${t.id.slice(0, 8).toUpperCase()}`;
      const counterparty = t.counterpartyName || supplierNames.get(t.supplierId || '') || captainNames.get(t.captainId || '') || salary?.payrollPeriod.employee.name || partner?.partnerRule.partnerName || (t.type === 'COD_SETTLEMENT' || t.type === 'COD_SETTLEMENT_REVERSAL' ? t.description.match(/\(([^)]+)\)/)?.[1] : '') || '';
      const cashRecipient = t.direction === 'IN' ? employeeNames.get(t.receivedByEmployeeId || '') || counterparty : counterparty;
      return {
        id: t.id, reference, category: t.type,
        title: expense ? `مصروف · ${expense.category}` : labels[t.type] || t.type, subtitle: t.description, amountFils: t.amount,
        direction: t.direction, date: t.createdAt, status: 'RECORDED', admin: employeeNames.get(t.createdByEmployeeId || '') || 'النظام',
        receiver: cashRecipient, fundAccount: t.fundAccount,
        paymentMethod: t.paymentMethod || '', transferToFundAccount: t.transferToFundAccount || '',
      };
    });
  }

}
