'use client';

import React from 'react';
import Link from 'next/link';
import { filsToDisplay } from '@/lib/money';
import { RawaqProductFrame } from '@/components/RawaqProductFrame';
import Image from 'next/image';
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
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted || !products || products.length === 0) return null;

  const scroll = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const step = Math.max(220, Math.floor(track.clientWidth * 0.72));
    track.scrollBy({ left: direction * step * (isAr ? -1 : 1), behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {products.length > 2 && (
        <div className="mb-4 flex justify-end gap-2">
          <button type="button" onClick={() => scroll(-1)} aria-label={isAr ? 'المنتجات السابقة' : 'Previous products'} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E9DDCC] bg-white text-[#3F4832] shadow-sm transition hover:bg-[#F7F3EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B7935F]">
            {isAr ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label={isAr ? 'المنتجات التالية' : 'Next products'} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E9DDCC] bg-white text-[#3F4832] shadow-sm transition hover:bg-[#F7F3EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B7935F]">
            {isAr ? <ChevronLeft size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
          </button>
        </div>
      )}
      <div ref={trackRef} dir={isAr ? 'rtl' : 'ltr'} className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 sm:gap-5">
      {products.map((product) => {
        const imageUrl = product.imageUrl?.startsWith('local://')
          ? product.imageUrl.replace('local://', '/')
          : product.imageUrl || '/brand/logo_rawaq.png';

        const productName = isAr ? product.nameAr : product.nameEn;

        return (
          <Link
            key={product.id}
            href={`/${locale}/products/${product.slug}`}
            className="group relative flex w-[148px] shrink-0 snap-start flex-col outline-none transition-all duration-300 hover:-translate-y-1 sm:w-[176px] lg:w-[190px]"
          >
            <RawaqProductFrame className="w-full shrink-0">
                <Image
                  src={imageUrl}
                  alt={productName}
                  fill
                  sizes="(max-width: 640px) 148px, (max-width: 1024px) 176px, 190px"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
            </RawaqProductFrame>

            <div className="flex flex-1 flex-col pt-4 px-2 text-center bg-transparent">
              <h3 className="mb-1 min-h-[2.75rem] line-clamp-2 text-sm font-bold leading-6 text-[#2B2B2B] transition-colors group-hover:text-[#3F4832]">
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
