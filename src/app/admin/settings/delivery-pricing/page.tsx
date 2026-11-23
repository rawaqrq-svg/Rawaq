import Link from 'next/link';
import { requirePermission } from '@/lib/dal';
import { prisma } from '@/lib/db';
import { AdminSidebar } from '@/components/AdminSidebar';
import DeliveryTariffManager from './DeliveryTariffManager';

export default async function DeliveryPricingPage() {
  const session = await requirePermission('section:settings');
  const versions = await prisma.deliveryTariffVersion.findMany({
    include: { tiers: { orderBy: { minLocations: 'asc' } } },
    orderBy: [{ companyName: 'asc' }, { effectiveFrom: 'desc' }],
  });
  const safeVersions = versions.map(version => ({
    id: version.id,
    companyName: version.companyName,
    effectiveFrom: version.effectiveFrom.toISOString(),
    createdAt: version.createdAt.toISOString(),
    note: version.note,
    tiers: version.tiers.map(tier => ({ id: tier.id, minLocations: tier.minLocations, maxLocations: tier.maxLocations, costFils: tier.costFils })),
  }));

  return <div className="flex min-h-screen flex-col bg-stone-50 md:flex-row" dir="rtl">
    <AdminSidebar employeeName={session.employee.name} roleName={session.employee.role.name} />
    <main className="min-w-0 w-full flex-1 space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black text-stone-900">إدارة أسعار شركات التوصيل</h1><p className="mt-1 text-sm text-stone-600">شرائح مستقلة لكل شركة، تتحدد حسب عدد محطات الاستلام في رحلة الطلبية.</p></div><Link href="/admin/settings" className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-bold">العودة لطلبيات التوصيل</Link></div>
      <DeliveryTariffManager initialVersions={safeVersions} now={new Date().getTime()} />
    </main>
  </div>;
}
