'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/dal';
import { ProfitsService } from '@/lib/profits/profits-service';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export async function getProfitsOverviewAction(fromDateStr?: string, toDateStr?: string) {
  await requirePermission('section:financials');
  const fromDate = fromDateStr ? new Date(`${fromDateStr}T00:00:00.000Z`) : undefined;
  const toDate = toDateStr ? new Date(`${toDateStr}T23:59:59.999Z`) : undefined;
  return await ProfitsService.getProfitsKPIs(fromDate, toDate);
}

export async function getEmployeePayrollAction() {
  await requirePermission('section:financials');
  return await ProfitsService.getEmployeePayrollList();
}

export async function disburseSalaryPaymentAction(
  payrollPeriodId: string,
  input: {
    amountFils?: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CLIK';
    paymentReference?: string;
    notes?: string;
  }
) {
  const session = await requirePermission('manage:financials');
  try {
    const payment = await ProfitsService.disburseSalaryPayment(
      payrollPeriodId,
      input,
      session.employeeId,
      session.employee.name
    );
    revalidatePath('/admin/profits');
    revalidatePath('/admin/reports');
    return { success: true, payment };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر صرف الراتب.' };
  }
}

export async function getPartnersSummaryAction(fromDateStr?: string, toDateStr?: string) {
  await requirePermission('section:financials');
  const fromDate = fromDateStr ? new Date(`${fromDateStr}T00:00:00.000Z`) : undefined;
  const toDate = toDateStr ? new Date(`${toDateStr}T23:59:59.999Z`) : undefined;
  return await ProfitsService.getPartnersSummary(fromDate, toDate);
}

export async function disbursePartnerPayoutAction(
  partnerRuleId: string,
  input: {
    amountFils: number;
    payoutType: 'PROFIT_DISTRIBUTION' | 'DRAWING_ON_ACCOUNT' | 'ADMINISTRATIVE_WAGE';
    paymentMethod: string;
    paymentReference?: string;
    notes?: string;
  }
) {
  const session = await requirePermission('manage:financials');
  try {
    const payout = await ProfitsService.disbursePartnerPayout(
      partnerRuleId,
      input,
      session.employeeId,
      session.employee.name
    );
    revalidatePath('/admin/profits');
    revalidatePath('/admin/reports');
    return { success: true, payout };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر صرف دفعة الشريك.' };
  }
}

export async function updateEmployeePayAgreementAction(
  employeeId: string,
  input: {
    baseRateFils: number;
    contractType: string;
    weeklyAgreedHours: number;
    notes?: string;
  }
) {
  const session = await requirePermission('manage:financials');
  try {
    const agreement = await ProfitsService.updateEmployeePayAgreement(
      employeeId,
      input,
      session.employeeId,
      session.employee.name
    );
    revalidatePath('/admin/profits');
    return { success: true, agreement };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر تحديث اتفاقية الراتب.' };
  }
}

export async function updatePartnerShareRulesAction(
  rules: Array<{
    id?: string;
    partnerName: string;
    sharePercentage: number;
    partnerEmployeeId?: string | null;
    bankDetails?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }>
) {
  const session = await requirePermission('manage:financials');
  try {
    const updatedRules = await ProfitsService.updatePartnerShareRules(
      rules,
      session.employeeId,
      session.employee.name
    );
    revalidatePath('/admin/profits');
    return { success: true, rules: updatedRules };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر تحديث نسب الشركاء.' };
  }
}

export async function getProfitsLedgerAction(limit = 50, fromDateStr?: string, toDateStr?: string) {
  await requirePermission('section:financials');
  const fromDate = fromDateStr ? new Date(`${fromDateStr}T00:00:00.000Z`) : undefined;
  const toDate = toDateStr ? new Date(`${toDateStr}T23:59:59.999Z`) : undefined;
  return await ProfitsService.getProfitsFullLedger(limit, fromDate, toDate);
}

export async function recordCashDepositAction(amountInput: number, noteInput?: string, requestKey?: string) {
  const session = await requirePermission('manage:financials');
  const parsed = z.object({ amountFils: z.number().int().positive().max(1_000_000_000), note: z.string().trim().max(240).optional(), requestKey: z.string().trim().min(16).max(80) })
    .safeParse({ amountFils: amountInput, note: noteInput, requestKey });
  if (!parsed.success) return { success: false as const, error: 'أدخل مبلغ إيداع صحيحاً.' };
  try {
    await prisma.$transaction(async tx => {
      const businessEventKey = `cash-deposit:${parsed.data.requestKey}`;
      if (await tx.financialTransaction.findUnique({ where: { businessEventKey }, select: { id: true } })) return;
      const rows = await tx.financialTransaction.findMany({ where: { fundAccount: 'CASH' }, select: { direction: true, amount: true, transferToFundAccount: true } });
      const cashBalance = rows.reduce((sum, row) => sum + (row.direction === 'IN' ? row.amount : row.direction === 'OUT' ? -row.amount : row.direction === 'TRANSFER' ? -row.amount : 0) + (row.direction === 'TRANSFER' && row.transferToFundAccount === 'CASH' ? row.amount : 0), 0);
      if (parsed.data.amountFils > cashBalance) throw new Error('مبلغ الإيداع أكبر من النقد المسجل في الصندوق.');
      await tx.financialTransaction.create({ data: {
        type: 'CASH_DEPOSIT', direction: 'TRANSFER', amount: parsed.data.amountFils,
        fundAccount: 'CASH', transferToFundAccount: 'BANK', paymentMethod: 'CASH',
        description: parsed.data.note || 'إيداع نقدي في الحساب البنكي', createdByEmployeeId: session.employeeId,
        businessEventKey,
      } });
      await tx.auditLog.create({ data: { employeeId: session.employeeId, action: 'CASH_DEPOSIT_RECORDED', entityType: 'FinancialTransaction', entityId: 'cash-deposit', details: JSON.stringify({ amountFils: parsed.data.amountFils, note: parsed.data.note || null }) } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/profits');
    return { success: true as const };
  } catch (error: any) { return { success: false as const, error: error.message || 'تعذر تسجيل الإيداع.' }; }
}

export async function recordBankOpeningBalanceAction(amountInput: number) {
  const session = await requirePermission('manage:financials');
  const parsed = z.number().int().min(0).max(1_000_000_000).safeParse(amountInput);
  if (!parsed.success) return { success: false as const, error: 'أدخل رصيداً افتتاحياً صحيحاً.' };
  try {
    await prisma.$transaction(async tx => {
      if (await tx.financialTransaction.findUnique({ where: { businessEventKey: 'bank-opening-balance:initial' } })) throw new Error('تم تسجيل الرصيد الافتتاحي مسبقاً ولا يمكن تعديله.');
      await tx.financialTransaction.create({ data: { type: 'BANK_OPENING_BALANCE', direction: 'IN', amount: parsed.data, fundAccount: 'BANK', paymentMethod: 'BANK_TRANSFER', businessEventKey: 'bank-opening-balance:initial', description: 'الرصيد الافتتاحي حسب كشف البنك', createdByEmployeeId: session.employeeId } });
      await tx.auditLog.create({ data: { employeeId: session.employeeId, action: 'BANK_OPENING_BALANCE_RECORDED', entityType: 'FinancialTransaction', entityId: 'bank-opening-balance:initial', details: JSON.stringify({ amountFils: parsed.data }) } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/profits');
    return { success: true as const };
  } catch (error: any) { return { success: false as const, error: error.message || 'تعذر تسجيل الرصيد الافتتاحي.' }; }
}

export async function recordCashOpeningBalanceAction(amountInput: number) {
  const session = await requirePermission('manage:financials');
  const parsed = z.number().int().min(0).max(1_000_000_000).safeParse(amountInput);
  if (!parsed.success) return { success: false as const, error: 'أدخل رصيداً نقدياً افتتاحياً صحيحاً.' };
  try {
    await prisma.$transaction(async tx => {
      if (await tx.financialTransaction.findUnique({ where: { businessEventKey: 'cash-opening-balance:initial' } })) throw new Error('تم تسجيل رصيد الصندوق الافتتاحي مسبقاً ولا يمكن تعديله.');
      await tx.financialTransaction.create({ data: { type: 'CASH_OPENING_BALANCE', direction: 'IN', amount: parsed.data, fundAccount: 'CASH', paymentMethod: 'CASH', businessEventKey: 'cash-opening-balance:initial', description: 'الرصيد الافتتاحي للصندوق حسب الجرد', createdByEmployeeId: session.employeeId, receivedByEmployeeId: session.employeeId } });
      await tx.auditLog.create({ data: { employeeId: session.employeeId, action: 'CASH_OPENING_BALANCE_RECORDED', entityType: 'FinancialTransaction', entityId: 'cash-opening-balance:initial', details: JSON.stringify({ amountFils: parsed.data }) } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/profits');
    return { success: true as const };
  } catch (error: any) { return { success: false as const, error: error.message || 'تعذر تسجيل رصيد الصندوق الافتتاحي.' }; }
}
