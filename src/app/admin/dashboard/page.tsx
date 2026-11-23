import Link from 'next/link';
import { requirePermission, getEmployeePermissions } from '@/lib/dal';
import { prisma } from '@/lib/db';
import { AdminSidebar } from '@/components/AdminSidebar';
import { filsToDisplay } from '@/lib/money';
import { getInventorySettings } from '@/actions/settings-crud';

export default async function AdminDashboardPage() {
  const session = await requirePermission('section:dashboard');
  const permissions = await getEmployeePermissions(session.employeeId);
  const canSeeOrders = permissions.includes('section:orders');
  const canSeeFinance = permissions.includes('section:financials');
  const canSeeInventory = permissions.includes('section:inventory');

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const valid = { status: { in: ['CONFIRMED', 'PREPARING', 'PREPARED', 'ASSIGNED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY'] } };

  const [ordersToday, ordersMonth, salesToday, txMonth, monthExpenses, pending, settings, supplierRows, captainRows, orderRows] = await Promise.all([
    canSeeOrders ? prisma.order.count({ where: { ...valid, createdAt: { gte: today } } }) : 0,
    canSeeFinance ? prisma.order.aggregate({ where: { ...valid, createdAt: { gte: month } }, _count: true, _sum: { totalAmount: true, shippingCost: true } }) : Promise.resolve({ _count: 0, _sum: { totalAmount: null, shippingCost: null } }),
    canSeeFinance ? prisma.order.aggregate({ where: { ...valid, createdAt: { gte: today } }, _sum: { totalAmount: true, shippingCost: true } }) : Promise.resolve({ _sum: { totalAmount: null, shippingCost: null } }),
    canSeeFinance ? prisma.financialTransaction.groupBy({ by: ['type'], where: { createdAt: { gte: month } }, _sum: { amount: true } }) : [],
    canSeeFinance ? prisma.expense.aggregate({ where: { expenseDate: { gte: month } }, _sum: { amount: true } }) : Promise.resolve({ _sum: { amount: null } }),
    canSeeOrders ? prisma.order.count({ where: { status: { in: ['AWAITING_WHATSAPP', 'PENDING', 'CONFIRMED'] } } }) : 0,
    canSeeInventory ? getInventorySettings() : Promise.resolve({ lowStockThreshold: 0 } as Awaited<ReturnType<typeof getInventorySettings>>),
    canSeeFinance ? prisma.financialTransaction.findMany({ where: { type: { in: ['SUPPLIER_OBLIGATION', 'SUPPLIER_OBLIGATION_REVERSAL', 'SUPPLIER_PAYMENT'] } }, select: { type: true, amount: true } }) : [],
    canSeeFinance ? prisma.financialTransaction.findMany({ where: { type: { in: ['CAPTAIN_EARNING', 'CAPTAIN_PAYMENT'] } }, select: { type: true, amount: true } }) : [],
    canSeeFinance ? prisma.order.findMany({ where: { ...valid, createdAt: { gte: month } }, select: { shippingCost: true, actualDeliveryCost: true, deliveryAssignment: { select: { id: true } }, items: { select: { unitCostSnapshot: true } } } }) : [],
  ]);

  const total = (type: string) => txMonth.find((group) => group.type === type)?._sum.amount ?? 0;
  const deliveryRevenue = total('DELIVERY_REVENUE') - total('DELIVERY_REVENUE_REVERSAL');
  const sales = total('SALE') - total('SALE_REVERSAL') - total('REFUND') - deliveryRevenue;
  const costs = total('PRODUCT_COST') - total('PRODUCT_COST_REVERSAL');
  const obligations = total('SUPPLIER_OBLIGATION') - total('SUPPLIER_OBLIGATION_REVERSAL');
  const grossProfit = sales - costs - Math.max(0, obligations - costs);
  const netProfit = grossProfit - (monthExpenses._sum.amount ?? 0);
  const supplierBalance = supplierRows.filter((row) => row.type === 'SUPPLIER_OBLIGATION').reduce((sum, row) => sum + row.amount, 0)
    - supplierRows.filter((row) => row.type === 'SUPPLIER_OBLIGATION_REVERSAL' || row.type === 'SUPPLIER_PAYMENT').reduce((sum, row) => sum + row.amount, 0);
  const captainBalance = captainRows.filter((row) => row.type === 'CAPTAIN_EARNING').reduce((sum, row) => sum + row.amount, 0)
    - captainRows.filter((row) => row.type === 'CAPTAIN_PAYMENT').reduce((sum, row) => sum + row.amount, 0);
  const lowStock = canSeeInventory
    ? await prisma.productVariant.count({ where: { stock: { lte: settings.lowStockThreshold }, isActive: true } })
    : null;
  const unknown = orderRows.reduce((count, order) => count + order.items.filter((item) => item.unitCostSnapshot === null).length, 0)
    + orderRows.filter((order) => order.actualDeliveryCost === null || (order.shippingCost > 0 && !order.deliveryAssignment)).length;
  const productSalesToday = (salesToday._sum.totalAmount ?? 0) - (salesToday._sum.shippingCost ?? 0);
  const productSalesMonth = (ordersMonth._sum.totalAmount ?? 0) - (ordersMonth._sum.shippingCost ?? 0);

  const cards: Array<[string, string]> = [];
  if (canSeeOrders) {
    cards.push(['طلبات اليوم', String(ordersToday)], ['طلبات بانتظار المتابعة', String(pending)]);
  }
  if (canSeeFinance) {
    cards.push(
      ['مبيعات المنتجات اليوم', filsToDisplay(productSalesToday)],
      ['مبيعات المنتجات هذا الشهر', filsToDisplay(productSalesMonth)],
      ['طلبات هذا الشهر', String(ordersMonth._count)],
      ['متوسط الطلب هذا الشهر', filsToDisplay(ordersMonth._count ? productSalesMonth / ordersMonth._count : 0)],
      ['الربح الإجمالي هذا الشهر', unknown ? 'غير مكتمل' : filsToDisplay(grossProfit)],
      ['صافي الربح هذا الشهر', unknown ? 'غير مكتمل' : filsToDisplay(netProfit)],
      ['رصيد الموردين', filsToDisplay(supplierBalance)],
      ['رصيد المندوبين', filsToDisplay(captainBalance)],
    );
  }
  if (lowStock !== null) cards.push(['درجات منخفضة المخزون', String(lowStock)]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-ivory-100)] md:flex-row" dir="rtl">
      <AdminSidebar employeeName={session.employee.name} roleName={session.employee.role.name} />
      <main className="min-w-0 max-w-full w-full flex-1 space-y-6 p-4 md:p-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-3xl font-bold">لوحة الأعمال</h1><p className="mt-1 text-sm text-zinc-600">ملخص الأقسام المصرح بها لهذا الحساب.</p></div>
          {canSeeFinance && <div className="flex gap-2"><Link className="rounded border bg-white px-3 py-2 text-sm" href="/admin/reconciliation">التسويات</Link><Link className="rounded border bg-white px-3 py-2 text-sm" href="/admin/reconciliation?v=reports">التقارير</Link></div>}
        </header>
        {canSeeFinance && unknown > 0 && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">بيانات ربح الشهر غير مكتملة: توجد {unknown} عناصر أو طلبات بلا تكلفة تاريخية مسجلة.</div>}
        {cards.length ? (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value]) => <article key={label} className="rounded-lg border bg-white p-5"><h2 className="text-sm text-zinc-500">{label}</h2><p className="mt-2 text-2xl font-bold">{value}</p></article>)}</section>
        ) : <p className="rounded-lg border bg-white p-5 text-sm text-zinc-600">لا توجد أقسام تشغيلية إضافية مفعلة في هذا الحساب.</p>}
      </main>
    </div>
  );
}
