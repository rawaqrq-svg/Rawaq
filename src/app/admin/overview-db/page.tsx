import { requirePermission } from '@/lib/dal';
import { prisma } from '@/lib/db';
import { AdminSidebar } from '@/components/AdminSidebar';
import { connection } from 'next/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let index = -1;
  do { amount /= 1024; index++; } while (amount >= 1024 && index < units.length - 1);
  return `${amount.toFixed(2)} ${units[index]}`;
}

function quota(name: string, used: number) {
  const configured = Number(process.env[name]);
  const total = Number.isFinite(configured) && configured > 0 ? configured : null;
  return { used: bytes(used), remaining: total === null ? 'غير متاح' : bytes(Math.max(0, total - used)), percent: total === null ? null : Math.min(100, used / total * 100) };
}

export default async function OverviewDbPage() {
  const session = await requirePermission('manage:settings');
  await connection();
  const [databaseSize, storageSize, products, variants, categories, orders, customers, images, tables] = await Promise.all([
    prisma.$queryRaw<Array<{ size: bigint }>>`SELECT pg_database_size(current_database())::bigint AS size`,
    prisma.$queryRaw<Array<{ size: bigint }>>`SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)::bigint AS size FROM storage.objects WHERE metadata->>'size' ~ '^[0-9]+$'`.catch(() => null),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.category.count(),
    prisma.order.count(),
    prisma.customer.count(),
    prisma.productImage.count(),
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  ]);
  const dbUsed = Number(databaseSize[0]?.size || 0);
  const storageUsed = storageSize ? Number(storageSize[0]?.size || 0) : null;
  const dbQuota = quota('SUPABASE_DATABASE_QUOTA_BYTES', dbUsed);
  const storageQuota = storageUsed === null ? null : quota('SUPABASE_STORAGE_QUOTA_BYTES', storageUsed);
  const cards = [
    ['الجداول', Number(tables[0]?.count || 0)], ['المنتجات', products], ['درجات وأسعار المنتجات', variants],
    ['الأقسام', categories], ['صور المنتجات المسجلة', images], ['الطلبات', orders], ['العملاء', customers],
  ] as const;
  return <div className="flex min-h-screen flex-col bg-[var(--color-ivory-100)] md:flex-row" dir="rtl">
    <AdminSidebar employeeName={session.employee.name} roleName={session.employee.role.name} />
    <main className="min-w-0 w-full flex-1 space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">overview db</h1><p className="mt-1 text-sm text-zinc-600">قراءة مباشرة من قاعدة البيانات عند كل فتح أو تحديث للصفحة.</p></div><Link href="/admin/overview-db" className="rounded border bg-white px-4 py-2 text-sm">تحديث البيانات</Link></header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-lg border bg-white p-5"><h2 className="text-sm text-zinc-500">حجم قاعدة البيانات المستخدم</h2><p className="mt-2 text-2xl font-bold">{dbQuota.used}</p><p className="mt-2 text-sm">المتبقي من الخطة: {dbQuota.remaining}</p>{dbQuota.percent !== null && <progress className="mt-3 w-full" value={dbQuota.percent} max="100" />}</article>
        <article className="rounded-lg border bg-white p-5"><h2 className="text-sm text-zinc-500">حجم ملفات Supabase Storage</h2><p className="mt-2 text-2xl font-bold">{storageQuota?.used || 'غير متاح'}</p><p className="mt-2 text-sm">المتبقي من الخطة: {storageQuota?.remaining || 'غير متاح'}</p>{storageQuota?.percent !== null && storageQuota?.percent !== undefined && <progress className="mt-3 w-full" value={storageQuota.percent} max="100" />}</article>
        {cards.map(([label, value]) => <article key={label} className="rounded-lg border bg-white p-5"><h2 className="text-sm text-zinc-500">{label}</h2><p className="mt-2 text-2xl font-bold">{value.toLocaleString('ar-JO')}</p></article>)}
      </section>
      {(dbQuota.percent === null || storageQuota?.percent === null) && <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">المساحة المستخدمة مقاسة مباشرة. لمعرفة المتبقي بدقة، اضبط حد خطة Supabase في متغيرَي البيئة SUPABASE_DATABASE_QUOTA_BYTES وSUPABASE_STORAGE_QUOTA_BYTES؛ لا يمكن استنتاج حد الخطة من قاعدة البيانات.</p>}
    </main>
  </div>;
}
