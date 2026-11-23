import Link from 'next/link';
import { requirePermission } from '@/lib/dal';
import { prisma } from '@/lib/db';
import { filsToDisplay } from '@/lib/money';
import { AdminSidebar } from '@/components/AdminSidebar';
import { type GiftVariantOption } from '@/components/RewardGiftPicker';
import { RewardRuleForm } from '@/components/admin/RewardRuleForm';

const rewardLabel: Record<string, string> = { FREE_DELIVERY: 'توصيل مجاني', PERCENT: 'خصم بنسبة', FIXED: 'خصم ثابت', FREE_PRODUCT: 'منتج هدية' };
const orderStatusLabel: Record<string, string> = {
  PENDING: 'بانتظار التأكيد', AWAITING_WHATSAPP: 'بانتظار واتساب', PROCESSING: 'قيد التجهيز', PARTIALLY_READY: 'جاهز جزئيًا',
  DELIVERED: 'تم التوصيل', COMPLETED: 'مكتمل', CANCELLED: 'ملغي', REFUNDED: 'مسترد',
};
const rewardTypes = ['ALL', 'FREE_PRODUCT', 'FREE_DELIVERY', 'PERCENT', 'FIXED'] as const;
const redemptionStates = ['ALL', 'ACTIVE', 'VOIDED'] as const;
const PAGE_SIZE = 20;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function scalar(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function saudiToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date()); }
function dateRange(from: string, to: string) {
  return { gte: new Date(`${from}T00:00:00.000+03:00`), lt: new Date(`${shiftDate(to, 1)}T00:00:00.000+03:00`) };
}
function pageUrl(params: Record<string, string>, page: number) {
  const next = new URLSearchParams(params);
  next.set('page', String(page));
  return `/admin/rewards?${next.toString()}`;
}
function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ar-JO', { dateStyle: 'medium', timeZone: 'Asia/Amman' }).format(date);
}

export default async function RewardsAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requirePermission('section:settings');
  const params = await searchParams;
  const today = saudiToday();
  const requestedFrom = validDate(scalar(params.from)) ? scalar(params.from)! : shiftDate(today, -29);
  const requestedTo = validDate(scalar(params.to)) ? scalar(params.to)! : today;
  const invalidRange = requestedFrom > requestedTo;
  const from = invalidRange ? requestedTo : requestedFrom;
  const to = invalidRange ? requestedFrom : requestedTo;
  const search = (scalar(params.q) ?? '').trim().slice(0, 100);
  const typeCandidate = scalar(params.type) ?? 'ALL';
  const stateCandidate = scalar(params.state) ?? 'ALL';
  const type = rewardTypes.includes(typeCandidate as typeof rewardTypes[number]) ? typeCandidate as typeof rewardTypes[number] : 'ALL';
  const state = redemptionStates.includes(stateCandidate as typeof redemptionStates[number]) ? stateCandidate as typeof redemptionStates[number] : 'ALL';
  const requestedPage = Number.parseInt(scalar(params.page) ?? '1', 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const dateFilter = dateRange(from, to);
  const now = new Date();
  const periodWhere = { isVoided: false, createdAt: dateFilter };
  const typeWhere = type === 'ALL' ? {} : { rewardRule: { rewardType: type } };
  const discountTypeWhere = type === 'ALL' ? { rewardRule: { rewardType: { in: ['PERCENT', 'FIXED'] } } } : { rewardRule: { rewardType: ['PERCENT', 'FIXED'].includes(type) ? type : '__NO_DISCOUNT__' } };
  const listWhere = {
    createdAt: dateFilter,
    ...(state === 'ACTIVE' ? { isVoided: false } : state === 'VOIDED' ? { isVoided: true } : {}),
    ...(type !== 'ALL' ? { rewardRule: { rewardType: type } } : {}),
    ...(search ? { OR: [
      { order: { reference: { contains: search, mode: 'insensitive' as const } } },
      { order: { customerName: { contains: search, mode: 'insensitive' as const } } },
      { rewardRule: { name: { contains: search, mode: 'insensitive' as const } } },
    ] } : {}),
  };
  const rules = await prisma.rewardRule.findMany({ orderBy: [{ priority: 'desc' }, { minimumAmount: 'asc' }] });
  const [giftVariants, redemptionStats, discountStats, giftStats, rewardedOrderStats, rulePerformance, redemptionCount, recentRedemptions] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true, product: { isVisible: true }, OR: [{ inventorySource: 'INTERNAL' }, { inventorySource: 'SUPPLIER', supplierOffers: { some: { isActive: true, supplier: { isActive: true } } } }] },
      select: { id: true, sku: true, size: true, price: true, stock: true, inventorySource: true, mainImage: true, colorName: true, supplierOffers: { where: { isActive: true, supplier: { isActive: true } }, select: { stock: true } }, product: { select: { nameAr: true, nameEn: true, images: { where: { isMain: true }, select: { url: true }, take: 1 } } } },
      orderBy: { product: { nameAr: 'asc' } },
    }),
    prisma.rewardRedemption.aggregate({ where: { ...periodWhere, ...typeWhere }, _count: { _all: true } }),
    prisma.rewardRedemption.aggregate({ where: { ...periodWhere, ...discountTypeWhere }, _sum: { amount: true } }),
    prisma.rewardRedemption.aggregate({ where: { ...periodWhere, giftVariantId: { not: null }, ...typeWhere }, _sum: { amount: true } }),
    prisma.order.aggregate({ where: { rewardRedemptions: { some: { ...periodWhere, ...typeWhere } } }, _count: { _all: true }, _avg: { totalAmount: true } }),
    prisma.rewardRedemption.groupBy({ by: ['rewardRuleId'], where: { ...periodWhere, ...typeWhere }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.rewardRedemption.count({ where: listWhere }),
    prisma.rewardRedemption.findMany({
      where: listWhere, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, amount: true, isVoided: true, giftNameSnapshot: true, createdAt: true, rewardRule: { select: { name: true, rewardType: true } }, order: { select: { id: true, reference: true, customerName: true, status: true, totalAmount: true } } },
    }),
  ]);
  const catalog = giftVariants as GiftVariantOption[];
  const performanceMap = new Map(rulePerformance.map(item => [item.rewardRuleId, item]));
  const activeCount = rules.filter(rule => rule.isActive && (!rule.startsAt || rule.startsAt <= now) && (!rule.endsAt || rule.endsAt >= now) && (rule.usageLimit === null || rule.usageCount < rule.usageLimit)).length;
  const totalPages = Math.max(1, Math.ceil(redemptionCount / PAGE_SIZE));
  const exportParams = new URLSearchParams({ from, to, type, state, q: search });
  const preserved = { from, to, type, state, q: search };

  return <div className="flex min-h-screen flex-col bg-[#F7F3EA] md:flex-row" dir="rtl">
    <AdminSidebar employeeName={session.employee.name} roleName={session.employee.role.name} />
    <main className="min-w-0 w-full flex-1 space-y-7 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold text-[#B7935F]">تجربة العميل · النمو والاحتفاظ</p><h1 className="mt-1 text-3xl font-black text-[#2B2B2B]">مكافآت العملاء</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">أنشئي قواعد واضحة وتابعي الاستبدالات وتكلفة الخصومات والهدايا خلال الفترة المحددة.</p></div>
        <a href="#new-reward" className="min-h-11 rounded-full bg-[#3F4832] px-5 py-3 text-center text-sm font-bold text-white shadow-sm">＋ إنشاء مكافأة</a>
      </header>

      <section aria-label="مؤشرات المكافآت للفترة" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black text-[#2B2B2B]">نتائج الفترة</h2><span className="text-xs text-zinc-500">{formatDate(dateFilter.gte)} — {formatDate(new Date(dateFilter.lt.getTime() - 1))}</span></div>
        {invalidRange && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">كان تاريخ البداية بعد النهاية، فعكسناهما لعرض الفترة المحددة.</p>}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'استبدالات غير ملغاة', value: redemptionStats._count._all.toLocaleString('ar-JO'), help: 'بعد استبعاد الاستبدالات الملغاة' },
            { label: 'طلبات استفادت من مكافأة', value: rewardedOrderStats._count._all.toLocaleString('ar-JO'), help: 'طلبات فريدة ضمن الفترة' },
            { label: 'قيمة الخصومات المسجلة', value: filsToDisplay(discountStats._sum.amount ?? 0), help: 'خصم ثابت أو نسبة، دون الهدايا' },
            { label: 'القيمة السعرية للهدايا', value: filsToDisplay(giftStats._sum.amount ?? 0), help: 'قيمة تقديرية بسعر المنتج المعتاد' },
          ].map(card => <article key={card.label} className="rounded-2xl border border-[#E9DDCC] bg-white p-4 shadow-sm md:p-5"><h3 className="text-xs font-bold text-zinc-500">{card.label}</h3><p className="mt-3 text-2xl font-black text-[#3F4832]">{card.value}</p><p className="mt-1 text-xs text-zinc-500">{card.help}</p></article>)}
        </div>
        <p className="rounded-xl border border-[#E9DDCC] bg-white px-4 py-3 text-sm text-zinc-700">متوسط قيمة الطلبات المستفيدة: <strong>{filsToDisplay(rewardedOrderStats._avg.totalAmount ?? 0)}</strong> · القواعد الفعالة الآن: <strong>{activeCount}</strong>. هذا وصف للطلبات المستفيدة ولا يقيس المبيعات الإضافية التي سببتها المكافأة.</p>
      </section>

      <section id="new-reward" className="scroll-mt-5 rounded-3xl border border-[#E9DDCC] bg-white p-4 shadow-sm md:p-6">
        <div className="mb-5"><h2 className="text-xl font-black text-[#2B2B2B]">إنشاء قاعدة مكافأة</h2><p className="mt-1 text-sm text-zinc-600">اختاري نوع المكافأة لتظهر إعداداتها المناسبة. تُحسب الأهلية من قيمة المنتجات قبل الخصومات، دون رسوم التوصيل.</p><p className="mt-2 rounded-xl bg-[#FBF8F2] p-3 text-xs leading-5 text-zinc-600">يمكن تطبيق التوصيل المجاني والهدية مع خصم واحد؛ عند وجود أكثر من خصم مؤهل يُطبّق أفضل خصم فقط. حد الاستخدام الإجمالي مشترك بين جميع العميلات.</p></div>
        <RewardRuleForm variants={catalog} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-black text-[#2B2B2B]">أداء القواعد</h2><p className="mt-1 text-sm text-zinc-600">الاستبدالات والتكلفة المسجلة خلال الفترة أعلاه.</p></div><span className="text-sm text-zinc-500">{rules.length.toLocaleString('ar-JO')} قاعدة</span></div>
        {rules.length === 0 ? <div className="rounded-2xl border border-dashed border-[#B7935F] bg-white p-10 text-center text-zinc-600">لا توجد مكافآت بعد. أنشئي أول مكافأة لبدء البرنامج.</div> : <div className="overflow-x-auto rounded-2xl border border-[#E9DDCC] bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-right text-sm"><thead className="bg-[#FBF8F2] text-xs text-zinc-600"><tr><th className="px-4 py-3">القاعدة</th><th className="px-4 py-3">الحد الأدنى</th><th className="px-4 py-3">الاستبدالات</th><th className="px-4 py-3">خصومات</th><th className="px-4 py-3">هدايا (تقديري)</th><th className="px-4 py-3">الحالة</th></tr></thead><tbody className="divide-y divide-zinc-100">
            {rules.map(rule => {
              const performance = performanceMap.get(rule.id);
              const currentlyActive = rule.isActive && (!rule.startsAt || rule.startsAt <= now) && (!rule.endsAt || rule.endsAt >= now) && (rule.usageLimit === null || rule.usageCount < rule.usageLimit);
              const cost = performance?._sum.amount ?? 0;
              return <tr key={rule.id} className="align-middle"><td className="px-4 py-3"><p className="font-bold text-zinc-900">{rule.name}</p><p className="mt-1 text-xs text-zinc-500">{rewardLabel[rule.rewardType] ?? rule.rewardType} · أولوية {rule.priority}</p><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-[#3F4832]">تعديل القاعدة</summary><div className="mt-3 max-w-2xl rounded-xl border border-[#E9DDCC] bg-[#FBF8F2]"><RewardRuleForm compact variants={catalog} initial={{ id: rule.id, name: rule.name, minimumAmount: rule.minimumAmount, rewardType: rule.rewardType as 'FREE_PRODUCT' | 'FREE_DELIVERY' | 'PERCENT' | 'FIXED', rewardValue: rule.rewardValue, usageLimit: rule.usageLimit, priority: rule.priority, startsAt: rule.startsAt?.toISOString() ?? null, endsAt: rule.endsAt?.toISOString() ?? null, giftVariantIds: rule.giftVariantIds, giftSelectionMode: rule.giftSelectionMode, isActive: rule.isActive }} /></div></details></td><td className="whitespace-nowrap px-4 py-3">{filsToDisplay(rule.minimumAmount)}</td><td className="px-4 py-3">{(performance?._count._all ?? 0).toLocaleString('ar-JO')}</td><td className="whitespace-nowrap px-4 py-3">{rule.rewardType === 'FIXED' || rule.rewardType === 'PERCENT' ? filsToDisplay(cost) : '—'}</td><td className="whitespace-nowrap px-4 py-3">{rule.rewardType === 'FREE_PRODUCT' ? filsToDisplay(cost) : '—'}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${currentlyActive ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700'}`}>{currentlyActive ? 'فعالة' : !rule.isActive ? 'متوقفة' : rule.usageLimit !== null && rule.usageCount >= rule.usageLimit ? 'اكتمل الحد' : rule.startsAt && rule.startsAt > now ? 'مجدولة' : 'منتهية'}</span></td></tr>;
            })}
          </tbody></table>
        </div>}
      </section>

      <section className="space-y-4 rounded-2xl border border-[#E9DDCC] bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black">سجل الاستبدالات</h2><p className="mt-1 text-sm text-zinc-600">ابحثي باسم العميلة أو رقم الطلب أو اسم القاعدة، وصدّري النتائج المطابقة.</p></div><a href={`/api/admin/rewards/export?${exportParams.toString()}`} className="min-h-10 rounded-xl border border-[#3F4832] px-4 py-2 text-sm font-bold text-[#3F4832]">تنزيل CSV</a></div>
        <form method="get" className="grid gap-3 rounded-xl bg-[#FBF8F2] p-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="grid gap-1 text-xs font-semibold">من تاريخ<input type="date" name="from" defaultValue={from} className="min-h-10 rounded-lg border border-[#E9DDCC] bg-white px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-semibold">إلى تاريخ<input type="date" name="to" defaultValue={to} className="min-h-10 rounded-lg border border-[#E9DDCC] bg-white px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-semibold">نوع المكافأة<select name="type" defaultValue={type} className="min-h-10 rounded-lg border border-[#E9DDCC] bg-white px-2 text-sm">{rewardTypes.map(value => <option key={value} value={value}>{value === 'ALL' ? 'كل الأنواع' : rewardLabel[value]}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-semibold">حالة الاستبدال<select name="state" defaultValue={state} className="min-h-10 rounded-lg border border-[#E9DDCC] bg-white px-2 text-sm"><option value="ALL">كل الحالات</option><option value="ACTIVE">غير ملغى</option><option value="VOIDED">ملغى أو مسترد</option></select></label>
          <label className="grid gap-1 text-xs font-semibold sm:col-span-2">بحث<input type="search" name="q" defaultValue={search} placeholder="اسم العميلة أو رقم الطلب أو القاعدة" className="min-h-10 rounded-lg border border-[#E9DDCC] bg-white px-3 text-sm" /></label>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-6"><button className="min-h-10 rounded-lg bg-[#3F4832] px-4 py-2 text-sm font-bold text-white">تطبيق المرشحات</button><Link href="/admin/rewards#history" className="min-h-10 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold leading-6">مسح المرشحات</Link><span className="self-center text-xs text-zinc-500">تظهر {redemptionCount.toLocaleString('ar-JO')} نتيجة · الترتيب من الأحدث</span></div>
        </form>
        <div id="history" className="divide-y divide-zinc-100">
          {recentRedemptions.length ? recentRedemptions.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><div className="min-w-0"><p className="font-bold text-zinc-900">{item.order.customerName} · {item.rewardRule.name}</p><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500"><Link href={`/admin/orders/${item.order.id}`} className="font-semibold text-[#3F4832] underline decoration-[#B7935F] underline-offset-2"><span dir="ltr">#{item.order.reference}</span></Link><span>{formatDate(item.createdAt)}</span><span>{orderStatusLabel[item.order.status] ?? item.order.status}</span>{item.giftNameSnapshot && <span>الهدية: {item.giftNameSnapshot}</span>}<span>قيمة الطلب: {filsToDisplay(item.order.totalAmount)}</span></p></div><div className="flex items-center gap-2"><span className="font-bold text-[#3F4832]">{item.amount > 0 ? filsToDisplay(item.amount) : item.giftNameSnapshot ? 'هدية' : 'توصيل مجاني'}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.isVoided ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{item.isVoided ? 'ملغى / مسترد' : 'محتسب'}</span></div></article>) : <p className="py-10 text-center text-sm text-zinc-500">لا توجد استبدالات تطابق المرشحات في هذه الفترة.</p>}
        </div>
        {redemptionCount > PAGE_SIZE && <nav aria-label="صفحات سجل الاستبدالات" className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-sm"><span className="text-zinc-600">صفحة {page.toLocaleString('ar-JO')} من {totalPages.toLocaleString('ar-JO')}</span><div className="flex gap-2">{page > 1 && <Link href={pageUrl(preserved, page - 1)} className="rounded-lg border border-zinc-300 px-3 py-2 font-semibold">الأحدث</Link>}{page < totalPages && <Link href={pageUrl(preserved, page + 1)} className="rounded-lg border border-zinc-300 px-3 py-2 font-semibold">الأقدم</Link>}</div></nav>}
      </section>
    </main>
  </div>;
}
