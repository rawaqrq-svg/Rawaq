'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDeliveryTariffVersionAction } from '@/actions/delivery-pricing';
import { filsToDisplay } from '@/lib/money';

type Tier = { min: string; max: string; cost: string };
type Version = { id: string; companyName: string; effectiveFrom: string; createdAt: string; note: string | null; tiers: Array<{ id: string; minLocations: number; maxLocations: number | null; costFils: number }> };
const riyadhDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const companyKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');

export default function DeliveryTariffManager({ initialVersions }: { initialVersions: Version[] }) {
  const router = useRouter();
  const [company, setCompany] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(riyadhDate);
  const [note, setNote] = useState('');
  const [tiers, setTiers] = useState<Tier[]>([{ min: '1', max: '1', cost: '2' }, { min: '2', max: '', cost: '3' }]);
  const [previewCount, setPreviewCount] = useState('3');
  const [previewCustomerFee, setPreviewCustomerFee] = useState('3');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  const activeVersionByCompany = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, Version>();
    [...initialVersions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).forEach(version => {
      if (new Date(version.effectiveFrom).getTime() <= now && !map.has(companyKey(version.companyName))) map.set(companyKey(version.companyName), version);
    });
    return map;
  }, [initialVersions]);

  const previewTier = useMemo(() => {
    const count = Number(previewCount);
    if (!Number.isInteger(count) || count < 1) return null;
    return tiers.find(tier => Number(tier.min) <= count && (!tier.max || count <= Number(tier.max)));
  }, [previewCount, tiers]);
  const previewCostFils = previewTier && Number.isFinite(Number(previewTier.cost)) ? Math.round(Number(previewTier.cost) * 1000) : null;
  const previewFeeFils = Math.round((Number(previewCustomerFee) || 0) * 1000);

  const addTier = () => setTiers(current => {
    const nextMin = current.length ? Math.max(...current.map(row => Number(row.max || row.min) || 0)) + 1 : 1;
    const previous = current[current.length - 1];
    const adjusted = previous && !previous.max ? [...current.slice(0, -1), { ...previous, max: String(nextMin - 1) }] : current;
    return [...adjusted, { min: String(nextMin), max: '', cost: '' }];
  });

  const seedVersion = (version: Version) => {
    setCompany(version.companyName);
    setEffectiveFrom(riyadhDate());
    setNote(`نسخة جديدة مبنية على تعرفة ${new Date(version.effectiveFrom).toLocaleDateString('ar-JO')}`);
    setTiers(version.tiers.map(tier => ({ min: String(tier.minLocations), max: tier.maxLocations === null ? '' : String(tier.maxLocations), cost: (tier.costFils / 1000).toFixed(3) })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage('');
    const result = await createDeliveryTariffVersionAction({
      companyName: company,
      effectiveFrom,
      note,
      tiers: tiers.map(row => ({ minLocations: Number(row.min), maxLocations: row.max ? Number(row.max) : null, costJod: Number(row.cost) })),
    });
    setPending(false);
    if (!result.success) { setMessage(result.error); return; }
    setMessage('تم حفظ إصدار التعرفة. الطلبات والطلبيات التي ثُبتت سابقاً تحتفظ بتكلفتها.');
    router.refresh();
  };

  return <div className="space-y-5">
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,.9fr)]">
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <div><h2 className="font-extrabold text-stone-900">إنشاء إصدار تعرفة</h2><p className="mt-1 text-xs text-stone-500">للتعديل، أنشئ إصداراً جديداً وحدد تاريخ سريانه. لا تتغير الطلبيات المحفوظة.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-stone-700">شركة التوصيل<input required minLength={2} maxLength={120} value={company} onChange={event => setCompany(event.target.value)} placeholder="مثال: شركة التوصيل" className="mt-1 w-full rounded-lg border border-stone-300 p-2.5 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-stone-700">تاريخ بدء التطبيق<input required type="date" min={riyadhDate()} value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-2.5 text-sm font-normal" /></label>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-stone-800">شرائح عدد محطات الاستلام</h3><p className="text-[11px] text-stone-500">اجعل الحد الأعلى فارغاً للشريحة المفتوحة. يمكن ترك فجوات؛ سيظهر تنبيه إذا لم تغطِ الشريحة العدد.</p></div><button type="button" onClick={addTier} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-bold">+ إضافة شريحة</button></div>
          {tiers.map((tier, index) => <div key={index} className="grid grid-cols-1 items-end gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
            <label className="text-[11px] font-bold text-stone-600">من محطة<input type="number" min="1" step="1" required value={tier.min} onChange={event => setTiers(rows => rows.map((row, i) => i === index ? { ...row, min: event.target.value } : row))} className="mt-1 w-full rounded border border-stone-300 bg-white p-2 text-sm" /></label>
            <label className="text-[11px] font-bold text-stone-600">إلى محطة<input type="number" min={tier.min || 1} step="1" placeholder="بلا حد أعلى" value={tier.max} onChange={event => setTiers(rows => rows.map((row, i) => i === index ? { ...row, max: event.target.value } : row))} className="mt-1 w-full rounded border border-stone-300 bg-white p-2 text-sm" /></label>
            <label className="text-[11px] font-bold text-stone-600">تكلفة الرحلة (د.أ)<input type="number" min="0" step="0.001" required value={tier.cost} onChange={event => setTiers(rows => rows.map((row, i) => i === index ? { ...row, cost: event.target.value } : row))} className="mt-1 w-full rounded border border-stone-300 bg-white p-2 text-sm" /></label>
            <button type="button" aria-label={`حذف الشريحة ${index + 1}`} disabled={tiers.length === 1} onClick={() => setTiers(rows => rows.filter((_, i) => i !== index))} className="rounded border border-red-200 px-3 py-2 text-xs font-bold text-red-800 disabled:opacity-40">حذف</button>
          </div>)}
        </div>
        <label className="block text-xs font-bold text-stone-700">ملاحظة للإصدار (اختياري)<input maxLength={300} value={note} onChange={event => setNote(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-2.5 text-sm font-normal" /></label>
        {message && <p role="status" className="rounded-lg bg-stone-50 p-3 text-xs font-bold text-stone-700">{message}</p>}
        <button disabled={pending} className="rounded-xl bg-[#3F4832] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? 'جارٍ اعتماد التعرفة...' : 'اعتماد إصدار التعرفة'}</button>
      </form>

      <aside className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:p-6">
        <div><h2 className="font-extrabold text-blue-950">معاينة التعرفة</h2><p className="mt-1 text-xs text-blue-800">تتغير المعاينة مع تعديل الشرائح ولا تحفظها.</p></div>
        <label className="block text-xs font-bold text-blue-950">عدد محطات الاستلام<input type="number" min="1" step="1" value={previewCount} onChange={event => setPreviewCount(event.target.value)} className="mt-1 w-full rounded-lg border border-blue-200 bg-white p-2.5 text-sm" /></label>
        <label className="block text-xs font-bold text-blue-950">رسوم العميل للمعاينة فقط (د.أ)<input type="number" min="0" step="0.001" value={previewCustomerFee} onChange={event => setPreviewCustomerFee(event.target.value)} className="mt-1 w-full rounded-lg border border-blue-200 bg-white p-2.5 text-sm" /></label>
        <div className="space-y-2 rounded-xl bg-white p-4 text-sm">
          <div className="flex justify-between"><span>تكلفة شركة التوصيل</span><strong>{previewCostFils === null ? 'لا توجد شريحة تغطي العدد' : filsToDisplay(previewCostFils, 'ar')}</strong></div>
          <div className="flex justify-between"><span>رسوم العميل التجريبية</span><strong>{filsToDisplay(previewFeeFils, 'ar')}</strong></div>
          <div className="flex justify-between border-t pt-2"><span>الفرق التجريبي</span><strong>{previewCostFils === null ? '—' : filsToDisplay(previewFeeFils - previewCostFils, 'ar')}</strong></div>
        </div>
        <p className="text-[11px] leading-5 text-blue-900">تغيير هذه التعرفة لا يغيّر رسوم العميل أو أسعار المناطق. تكلفة الشركة تُحفظ مرة واحدة على طلبية الاستلام، حسب عدد محطات الموردين/المحلات المتميزة فيها.</p>
      </aside>
    </section>

    <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
      <div><h2 className="font-extrabold text-stone-900">سجل إصدارات التعرفة</h2><p className="mt-1 text-xs text-stone-500">الإصدارات محفوظة للتدقيق ولا تُعدّل بعد اعتمادها؛ أنشئ إصداراً تالياً لتعديل الحدود أو الأسعار أو حذف شريحة.</p></div>
      {!initialVersions.length && <p className="rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-500">لا توجد تعرفة مسجلة بعد.</p>}
      <div className="space-y-3">{initialVersions.map(version => {
        const isScheduled = new Date(version.effectiveFrom).getTime() > Date.now();
        const isActive = !isScheduled && activeVersionByCompany.get(companyKey(version.companyName))?.id === version.id;
        return <article key={version.id} className="rounded-xl border border-stone-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-stone-900">{version.companyName}</h3><p className="text-[11px] text-stone-500">سريان من {new Date(version.effectiveFrom).toLocaleDateString('ar-JO')} · أُنشئت {new Date(version.createdAt).toLocaleDateString('ar-JO')}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isScheduled ? 'bg-blue-100 text-blue-900' : isActive ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-100 text-stone-700'}`}>{isScheduled ? 'مجدولة' : isActive ? 'نشطة' : 'سابقة'}</span><button type="button" onClick={() => seedVersion(version)} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-bold">استخدامها كأساس لإصدار جديد</button></div>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[28rem] text-right text-xs"><thead className="bg-stone-50 text-stone-600"><tr><th className="p-2">من محطة</th><th className="p-2">إلى محطة</th><th className="p-2">تكلفة الرحلة</th></tr></thead><tbody className="divide-y">{version.tiers.map(tier => <tr key={tier.id}><td className="p-2">{tier.minLocations}</td><td className="p-2">{tier.maxLocations ?? 'بلا حد أعلى'}</td><td className="p-2 font-bold">{filsToDisplay(tier.costFils, 'ar')}</td></tr>)}</tbody></table></div>
          {version.note && <p className="mt-2 text-xs text-stone-600">{version.note}</p>}
        </article>;
      })}</div>
    </section>
  </div>;
}
