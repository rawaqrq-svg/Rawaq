'use client';

import { useActionState, useState } from 'react';
import { saveRewardRule, toggleRewardRule } from '@/actions/marketing';
import { RewardGiftPicker, type GiftVariantOption } from '@/components/RewardGiftPicker';

type RewardType = 'FREE_PRODUCT' | 'FREE_DELIVERY' | 'PERCENT' | 'FIXED';
type RuleValues = {
  id?: string;
  name?: string;
  minimumAmount?: number;
  rewardType?: RewardType;
  rewardValue?: number;
  usageLimit?: number | null;
  priority?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  giftVariantIds?: string;
  giftSelectionMode?: string;
  isActive?: boolean;
};

const initialState = { status: 'idle' as const, message: '' };
const inputClass = 'min-h-11 rounded-xl border border-[#E9DDCC] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3F4832] focus:ring-2 focus:ring-[#3F4832]/15';

function saudiDate(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date(value));
}

export function RewardRuleForm({ variants, initial = {}, compact = false }: {
  variants: GiftVariantOption[];
  initial?: RuleValues;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveRewardRule, initialState);
  const [rewardType, setRewardType] = useState<RewardType>(initial.rewardType ?? 'FREE_PRODUCT');
  let initialGiftIds: string[] = [];
  try { initialGiftIds = JSON.parse(initial.giftVariantIds ?? '[]'); } catch { initialGiftIds = []; }
  const [initialMode] = useState(initial.giftSelectionMode === 'CUSTOMER_CHOICE' ? 'CUSTOMER_CHOICE' : 'FIXED');

  const fixed = initial.rewardType === 'FIXED';
  const rewardValue = initial.rewardValue == null ? 0 : fixed ? initial.rewardValue / 1000 : initial.rewardValue;
  const defaultDate = (value?: string | null) => value ? saudiDate(value) : '';
  const fieldLabel = compact ? 'grid gap-1 text-xs font-semibold' : 'grid gap-1.5 text-sm font-semibold';

  return <form action={formAction} className={`grid gap-4 ${compact ? 'border-t border-[#E9DDCC] p-4 sm:grid-cols-2 md:p-5' : ''}`}>
    {initial.id && <input type="hidden" name="id" value={initial.id} />}
    <label className={fieldLabel}>اسم المكافأة
      <input name="name" required minLength={2} maxLength={100} defaultValue={initial.name ?? ''} placeholder="مثال: هدية رَواق مع الطلبات الكبيرة" className={inputClass} />
    </label>
    <label className={fieldLabel}>الحد الأدنى لسلة المنتجات (د.أ)
      <input name="minimumAmount" type="number" min="0" step="0.001" required defaultValue={initial.minimumAmount == null ? '' : (initial.minimumAmount / 1000).toFixed(3)} placeholder="مثال: 30" className={inputClass} />
      <span className="text-xs font-normal leading-5 text-zinc-500">يُحتسب من قيمة المنتجات قبل الخصومات، ولا يشمل التوصيل.</span>
    </label>
    <label className={fieldLabel}>نوع المكافأة
      <select name="rewardType" value={rewardType} onChange={event => setRewardType(event.target.value as RewardType)} className={inputClass}>
        <option value="FREE_PRODUCT">منتج هدية</option><option value="FREE_DELIVERY">توصيل مجاني</option><option value="PERCENT">خصم بنسبة</option><option value="FIXED">خصم ثابت</option>
      </select>
    </label>

    {(rewardType === 'PERCENT' || rewardType === 'FIXED') && <label className={fieldLabel}>{rewardType === 'PERCENT' ? 'نسبة الخصم (%)' : 'مبلغ الخصم (د.أ)'}
      <input name="rewardValue" type="number" min={rewardType === 'PERCENT' ? 1 : 0} max={rewardType === 'PERCENT' ? 100 : undefined} step={rewardType === 'PERCENT' ? 1 : 0.001} required defaultValue={rewardType === (initial.rewardType === 'FIXED' ? 'FIXED' : 'PERCENT') ? rewardValue : ''} className={inputClass} key={`${initial.id ?? 'new'}-${rewardType}`} />
      <span className="text-xs font-normal text-zinc-500">{rewardType === 'PERCENT' ? 'من 1% إلى 100% من قيمة المنتجات المؤهلة.' : 'يُخصم من قيمة المنتجات، مع مراعاة حدود الخصم المالي.'}</span>
    </label>}

    <label className={fieldLabel}>الحد الإجمالي للاستبدال
      <input name="usageLimit" type="number" min="1" step="1" defaultValue={initial.usageLimit ?? ''} placeholder="اتركيه فارغًا بلا حد" className={inputClass} />
      <span className="text-xs font-normal text-zinc-500">حد للحملة كلها، وليس لكل عميلة.</span>
    </label>
    <label className={fieldLabel}>أولوية العرض
      <input name="priority" type="number" min="-10000" max="10000" step="1" defaultValue={initial.priority ?? 0} className={inputClass} />
      <span className="text-xs font-normal text-zinc-500">الأولوية الأعلى تحسم ترتيب القواعد المتساوية.</span>
    </label>
    <label className={fieldLabel}>تبدأ في (بتوقيت الأردن)
      <input name="startsAt" type="date" defaultValue={defaultDate(initial.startsAt)} className={inputClass} />
    </label>
    <label className={fieldLabel}>تنتهي في (بتوقيت الأردن)
      <input name="endsAt" type="date" defaultValue={defaultDate(initial.endsAt)} className={inputClass} />
      <span className="text-xs font-normal text-zinc-500">يظل العرض فعالًا حتى نهاية اليوم المحدد.</span>
    </label>

    {rewardType === 'FREE_PRODUCT' && <RewardGiftPicker variants={variants} initialIds={initialGiftIds} initialMode={initialMode} />}

    <div className={`${compact ? 'sm:col-span-2' : ''} flex flex-wrap items-center gap-3`}>
      <button disabled={pending} className="min-h-11 rounded-xl bg-[#3F4832] px-5 py-3 font-bold text-white transition hover:bg-[#2B3422] disabled:cursor-wait disabled:opacity-60">
        {pending ? 'جارٍ الحفظ…' : initial.id ? 'حفظ التعديلات' : 'حفظ المكافأة'}
      </button>
      {initial.id && <button type="submit" formAction={toggleRewardRule.bind(null, initial.id, !initial.isActive)} className="min-h-11 rounded-xl border border-zinc-300 px-4 py-2.5 font-bold">{initial.isActive ? 'إيقاف المكافأة' : 'تفعيل المكافأة'}</button>}
      {state.status !== 'idle' && <div role="status" aria-live="polite" className={`text-sm font-semibold ${state.status === 'success' ? 'text-emerald-700' : 'text-red-700'}`}><p>{state.message}</p>{state.details?.length ? <ul className="mt-1 list-inside list-disc font-normal">{state.details.map(detail => <li key={detail}>{detail}</li>)}</ul> : null}</div>}
    </div>
  </form>;
}
