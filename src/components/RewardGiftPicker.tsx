'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';

export type GiftVariantOption = {
  id: string;
  sku: string;
  size: string;
  price: number;
  stock: number;
  inventorySource: string;
  supplierOffers?: { stock: number }[];
  mainImage: string | null;
  colorName: string | null;
  product: { nameAr: string; nameEn: string; images?: { url: string }[] };
};

export function RewardGiftPicker({ variants, initialIds = [], initialMode = 'FIXED' }: {
  variants: GiftVariantOption[];
  initialIds?: string[];
  initialMode?: string;
}) {
  const [mode, setMode] = useState(initialMode === 'CUSTOMER_CHOICE' ? 'CUSTOMER_CHOICE' : 'FIXED');
  const [selected, setSelected] = useState<string[]>(initialIds.filter(id => variants.some(variant => variant.id === id)));
  const unavailableCount = initialIds.filter(id => !variants.some(variant => variant.id === id)).length;
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(40);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return variants;
    return variants.filter(variant => `${variant.product.nameAr} ${variant.product.nameEn} ${variant.size} ${variant.colorName ?? ''} ${variant.sku}`.toLocaleLowerCase().includes(q));
  }, [query, variants]);

  const toggle = (id: string) => setSelected(current => {
    if (current.includes(id)) return current.filter(value => value !== id);
    return mode === 'FIXED' ? [id] : [...current, id];
  });
  const setSelectionMode = (nextMode: string) => {
    setMode(nextMode);
    if (nextMode === 'FIXED') setSelected(current => current.slice(0, 1));
  };
  const stockFor = (variant: GiftVariantOption) => variant.inventorySource === 'INTERNAL' ? variant.stock : Math.max(0, ...(variant.supplierOffers ?? []).map(offer => offer.stock));

  return (
    <fieldset className="rounded-2xl border border-[#E9DDCC] bg-[#FBF8F2] p-4 sm:col-span-2">
      <legend className="px-2 font-bold text-[#3F4832]">🎁 إعداد الهدية</legend>
      <input type="hidden" name="giftVariantIds" value={JSON.stringify(selected)} />
      <label className="grid gap-1 text-sm font-semibold">طريقة الحصول على الهدية
        <select name="giftSelectionMode" value={mode} onChange={event => setSelectionMode(event.target.value)} className="rounded-xl border border-[#E9DDCC] bg-white px-3 py-2.5">
          <option value="FIXED">هدية محددة من المتجر</option>
          <option value="CUSTOMER_CHOICE">العميلة تختار من قائمة المنتجات</option>
        </select>
      </label>
      <p className="mt-2 text-xs text-zinc-600">{mode === 'FIXED' ? 'اختاري درجة/عبوة واحدة لتكون الهدية.' : 'اختاري المنتجات أو الدرجات التي ستظهر للعميلة لتختار واحدة منها.'}</p>
      {unavailableCount > 0 && <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">هناك {unavailableCount.toLocaleString('ar-JO')} اختيار سابق لم يعد ظاهرًا في المنتجات النشطة. احذفيه من القاعدة أو استبدليه قبل الحفظ.</p>}
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحثي باسم المنتج أو الدرجة أو SKU" className="mt-3 w-full rounded-xl border border-[#E9DDCC] bg-white px-3 py-2 text-sm" aria-label="بحث منتجات الهدايا" />
      <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-[#E9DDCC] bg-white p-2">
        {filtered.slice(0, visibleCount).map(variant => (
          <label key={variant.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[#FBF8F2]">
            <input type="checkbox" checked={selected.includes(variant.id)} onChange={() => toggle(variant.id)} className="h-4 w-4 accent-[#3F4832]" />
            {(variant.mainImage || variant.product.images?.[0]?.url) ? <Image unoptimized src={variant.mainImage || variant.product.images![0].url} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-lg bg-[#F7F3EA] object-cover" /> : <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F7F3EA] text-[#B7935F]">✦</span>}
            <span className="min-w-0 flex-1 truncate">{variant.product.nameAr} · {variant.size}{variant.colorName ? ` · ${variant.colorName}` : ''}</span>
            <span className="shrink-0 text-left text-xs text-zinc-500"><span dir="ltr" className="block">{variant.sku}</span><span className="block">المخزون المسجل: {stockFor(variant)}</span></span>
          </label>
        ))}
        {filtered.length === 0 && <p className="p-4 text-center text-sm text-zinc-500">لا توجد نتائج مطابقة.</p>}
      </div>
      {filtered.length > visibleCount && <button type="button" onClick={() => setVisibleCount(count => count + 40)} className="mt-2 min-h-10 rounded-lg border border-[#E9DDCC] px-3 text-sm font-semibold text-[#3F4832]">عرض 40 منتجًا إضافيًا ({filtered.length - visibleCount} متبقية)</button>}
      <p className="mt-2 text-xs font-semibold text-[#3F4832]">تم اختيار {selected.length} منتج/درجة</p>
    </fieldset>
  );
}
