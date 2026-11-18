'use client';

import React from 'react';
import Link from 'next/link';
import { filsToDisplay } from '@/lib/money';
import { RawaqProductFrame } from '@/components/RawaqProductFrame';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SuggestedProduct {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  imageUrl: string | null;
  lowestPrice: number;
}

interface SuggestedProductsProps {
  products: SuggestedProduct[];
  locale: string;
}

export default function SuggestedProducts({ products, locale }: SuggestedProductsProps) {
  const isAr = locale === 'ar';
  const [mounted, setMounted] = React.useState(false);
  const railRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setMounted(true), []);
  if (!mounted || !products || products.length === 0) return null;

  const moveRail = (direction: 'next' | 'previous') => {
    railRef.current?.scrollBy({
      left: direction === 'next' ? 280 : -280,
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative">
      <div className="mb-3 flex justify-end gap-2" dir="ltr">
        <button type="button" onClick={() => moveRail('previous')} aria-label={isAr ? 'المنتجات السابقة' : 'Previous products'} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E9DDCC] bg-white text-[#3F4832] shadow-sm transition hover:border-[#B7935F] hover:bg-[#F7F3EA]"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" onClick={() => moveRail('next')} aria-label={isAr ? 'المنتجات التالية' : 'Next products'} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E9DDCC] bg-white text-[#3F4832] shadow-sm transition hover:border-[#B7935F] hover:bg-[#F7F3EA]"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div ref={railRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:thin] sm:gap-4">
      {products.map((product) => {
        const imageUrl = product.imageUrl?.startsWith('local://')
          ? product.imageUrl.replace('local://', '/')
          : product.imageUrl || '/brand/logo_rawaq.png';

        const productName = isAr ? product.nameAr : product.nameEn;

        return (
          <Link
            key={product.id}
            href={`/${locale}/products/${product.slug}`}
            className="group relative flex w-[154px] shrink-0 snap-start flex-col outline-none transition-all duration-300 hover:-translate-y-1 sm:w-[190px]"
          >
            <RawaqProductFrame className="w-full shrink-0">
                <div className="h-full w-full bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-[1.03]" style={{ backgroundImage: `url("${imageUrl}")` }} />
            </RawaqProductFrame>

            <div className="flex flex-1 flex-col pt-4 px-2 text-center bg-transparent">
              <h3 className="mb-1 line-clamp-2 text-sm font-bold leading-6 text-[#2B2B2B] transition-colors group-hover:text-[#3F4832]">
                {productName}
              </h3>
              {product.lowestPrice > 0 && (
                <p className="mt-auto pt-1 text-sm font-bold text-[#3F4832]">
                  {isAr ? 'يبدأ من' : 'From'} <span className="text-base">{filsToDisplay(product.lowestPrice, isAr ? 'ar' : 'en')}</span>
                </p>
              )}
            </div>
          </Link>
        );
      })}
      </div>
    </div>
  );
}
