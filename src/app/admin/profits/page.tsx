import { requirePermission } from '@/lib/dal';
import { AdminSidebar } from '@/components/AdminSidebar';
import { ProfitsService } from '@/lib/profits/profits-service';
import ProfitsClientTabs from './ProfitsClientTabs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function ProfitsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePermission('section:financials');
  const params = searchParams ? await searchParams : {};
  const rawTab = params.tab || params.x || params.view || params.v;
  if (rawTab && ['close', 'approval', 'dual_approval', 'period_close', 'إغلاق', 'اعتماد', 'اغلاق'].includes(rawTab.trim().toLowerCase())) {
    redirect('/admin/profits?tab=overview');
  }
  const fromParam = params.from;
  const toParam = params.to;

  const fromDate = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : undefined;
  const toDate = toParam ? new Date(`${toParam}T23:59:59.999Z`) : undefined;

  // استعلامات متزامنة للبيانات المالية الرئيسية لمركز الأرباح وفق النطاق الزمني المحدد
  const parseLedgerDate = (value?: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  const ledgerFrom = parseLedgerDate(params.ledgerFrom);
  const ledgerTo = parseLedgerDate(params.ledgerTo);
  const [kpis, employees, partners, ledger, ledgerEmployees, balances, hasOpeningBalance, hasCashOpeningBalance] = await Promise.all([
    ProfitsService.getProfitsKPIs(fromDate, toDate),
    ProfitsService.getEmployeePayrollList(),
    ProfitsService.getPartnersSummary(fromDate, toDate),
    ProfitsService.getProfitsFullLedger(500, ledgerFrom, ledgerTo, params.receiver, params.method),
    prisma.employee.findMany({ where: { isActive: true, role: { name: { in: ['أدمن تشغيلي', 'أدمن رئيسي', 'ADMIN', 'Admin', 'SUPER ADMIN', 'Super Admin'] } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ProfitsService.getFundBalances(),
    prisma.financialTransaction.findUnique({ where: { businessEventKey: 'bank-opening-balance:initial' }, select: { id: true } }),
    prisma.financialTransaction.findUnique({ where: { businessEventKey: 'cash-opening-balance:initial' }, select: { id: true } }),
  ]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-stone-50" dir="rtl">
      <AdminSidebar
        employeeName={session.employee.name}
        roleName={session.employee.role.name}
      />

      <main className="min-w-0 max-w-full w-full flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <ProfitsClientTabs
            initialTab={rawTab}
            initialFrom={fromParam}
            initialTo={toParam}
            initialKpis={kpis}
            initialEmployees={employees}
            initialPartners={partners}
            initialLedger={ledger}
            ledgerEmployees={ledgerEmployees}
            balances={balances}
            hasOpeningBalance={Boolean(hasOpeningBalance)}
            hasCashOpeningBalance={Boolean(hasCashOpeningBalance)}
            ledgerFilters={{ from: params.ledgerFrom || '', to: params.ledgerTo || '', receiver: params.receiver || '', method: params.method || '' }}
          />
        </div>
      </main>
    </div>
  );
}
