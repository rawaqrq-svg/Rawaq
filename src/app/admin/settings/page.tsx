import { requirePermission } from '@/lib/dal';
import { getEmployeePermissions } from '@/lib/dal';
import { isMainAdminRole } from '@/lib/admin-permissions';
import { prisma } from '@/lib/db';
import { AdminSidebar } from '@/components/AdminSidebar';
import { DeliveryBatchWorkspace } from './DeliveryBatchWorkspace';
import Link from 'next/link';

export default async function DeliveryBatchSettingsPage() {
  const session = await requirePermission('section:delivery');
  const [preparedOrders, batches, tariffVersions, existingCompanies, permissions] = await Promise.all([
    prisma.order.findMany({
      where: {
        deliveryBatchId: null,
        deliveryAssignment: null,
        OR: [
          { status: 'PREPARED' },
          { status: 'CONFIRMED', fulfillmentStatus: { in: ['READY_FOR_PICKUP', 'ALL_PICKED_UP', 'PARTIALLY_READY'] } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, reference: true, customerName: true, customerPhone: true,
        shippingZoneNameSnapshot: true, totalAmount: true, shippingCost: true, createdAt: true,
        status: true, fulfillmentStatus: true,
        fulfillmentOrders: {
          select: {
            id: true,
            supplierId: true,
            locationId: true,
            status: true,
            supplier: { select: { name: true } },
            location: { select: { label: true, city: true } },
            packages: { select: { id: true, packageCode: true } },
          },
        },
        items: { select: { supplierIdSnapshot: true } },
      },
    }),
    prisma.deliveryBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        orders: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, reference: true, customerName: true, customerPhone: true,
            shippingZoneNameSnapshot: true, totalAmount: true, shippingCost: true, createdAt: true,
            status: true, fulfillmentStatus: true,
            deliveryAssignment: { select: { id: true } },
            fulfillmentOrders: {
              select: {
                id: true,
                supplierId: true,
                locationId: true,
                status: true,
                supplier: { select: { name: true } },
                location: { select: { label: true } },
                packages: { select: { id: true, packageCode: true } },
              },
            },
            items: { select: { supplierIdSnapshot: true } },
          },
        },
      },
    }),
    prisma.deliveryTariffVersion.findMany({ where: { effectiveFrom: { lte: new Date() } }, include: { tiers: { orderBy: { minLocations: 'asc' } } }, orderBy: { effectiveFrom: 'desc' } }),
    prisma.deliveryBatch.findMany({ where: { courierCompany: { not: null } }, select: { courierCompany: true }, distinct: ['courierCompany'] }),
    getEmployeePermissions(session.employeeId),
  ]);
  const latestTariffByCompany = new Map<string, typeof tariffVersions[number]>();
  for (const version of tariffVersions) if (!latestTariffByCompany.has(version.companyKey)) latestTariffByCompany.set(version.companyKey, version);
  const currentTariffs = [...latestTariffByCompany.values()].map(version => ({
    companyName: version.companyName,
    companyKey: version.companyKey,
    effectiveFrom: version.effectiveFrom,
    tiers: version.tiers.map(tier => ({ minLocations: tier.minLocations, maxLocations: tier.maxLocations, costFils: tier.costFils })),
  }));
  const knownCompanies = [...new Set([...currentTariffs.map(tariff => tariff.companyName), ...existingCompanies.map(item => item.courierCompany).filter(Boolean) as string[]])].sort();
  const canManageSettings = isMainAdminRole(session.employee.role.name) || permissions.includes('section:settings');

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-ivory-100)] md:flex-row" dir="rtl">
      <AdminSidebar employeeName={session.employee.name} roleName={session.employee.role.name} />
      <main className="min-w-0 max-w-full w-full flex-1 space-y-6 p-4 md:p-8">
        <header>
          <h1 className="text-3xl font-bold">طلبيات شركة التوصيل</h1>
          <p className="mt-1 text-sm text-zinc-600">أنشئ طلبية، عدّل محتواها، وشارك رابطها ثم سجّل نتيجة التوصيل من مكان واحد.</p>
          {canManageSettings && <Link href="/admin/settings/delivery-pricing" className="mt-3 inline-flex rounded-lg border border-emerald-800 px-4 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-50">إدارة أسعار شركات التوصيل حسب عدد المحلات</Link>}
        </header>
        <DeliveryBatchWorkspace preparedOrders={preparedOrders} batches={batches} currentTariffs={currentTariffs} knownCompanies={knownCompanies} />
      </main>
    </div>
  );
}
