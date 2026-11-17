'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { RawaqProductFrame } from '@/components/RawaqProductFrame';

type GalleryImage = { id?: string; url: string; isMain?: boolean; alt?: string | null };

export function ProductGallery({ images, productName, isAr }: { images: GalleryImage[]; productName: string; isAr: boolean; categorySlug?: string }) {
  const [variantImages, setVariantImages] = useState<GalleryImage[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const galleryImages = useMemo(() => {
    const unique = new Map<string, GalleryImage>();
    for (const image of [...images, ...variantImages]) {
      if (!image.url || image.url.includes('/images/templates/')) continue;
      if (!unique.has(image.url)) unique.set(image.url, image);
    }
    return [...unique.values()];
  }, [images, variantImages]);

  const current = galleryImages.find(image => image.url === selectedUrl)
    || galleryImages.find(image => image.isMain)
    || galleryImages[0];
  const currentIndex = Math.max(0, galleryImages.findIndex(image => image.url === current?.url));
  const imageUrl = current?.url.replace('local://', '/');

  const navigate = useCallback((direction: -1 | 1) => {
    if (galleryImages.length < 2) return;
    const nextIndex = (currentIndex + direction + galleryImages.length) % galleryImages.length;
    const nextImage = galleryImages[nextIndex];
    setSelectedUrl(nextImage.url);
    window.dispatchEvent(new CustomEvent('gallery-image-selected', { detail: { url: nextImage.url } }));
  }, [currentIndex, galleryImages]);

  useEffect(() => {
    const handleVariantChange = (event: Event) => {
      const detail = (event as CustomEvent<{ imageUrl?: string | null; images?: GalleryImage[] }>).detail;
      const nextImages = detail?.images || [];
      setVariantImages(nextImages);
      if (detail?.imageUrl) setSelectedUrl(detail.imageUrl);
    };
    window.addEventListener('variant-changed', handleVariantChange);
    return () => window.removeEventListener('variant-changed', handleVariantChange);
  }, []);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLightboxOpen(false);
      if (event.key === (isAr ? 'ArrowLeft' : 'ArrowRight')) {
        event.preventDefault();
        navigate(1);
      }
      if (event.key === (isAr ? 'ArrowRight' : 'ArrowLeft')) {
        event.preventDefault();
        navigate(-1);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isAr, isLightboxOpen, navigate]);

  const previousIcon = isAr ? ChevronRight : ChevronLeft;
  const nextIcon = isAr ? ChevronLeft : ChevronRight;
  const ArrowPrevious = previousIcon;
  const ArrowNext = nextIcon;
  const previousLabel = isAr ? 'الصورة السابقة' : 'Previous image';
  const nextLabel = isAr ? 'الصورة التالية' : 'Next image';

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="relative aspect-square w-full">
        <button
          type="button"
          disabled={!imageUrl}
          onClick={() => setIsLightboxOpen(true)}
          aria-label={isAr ? 'تكبير صورة المنتج' : 'Enlarge product photo'}
          className="group absolute inset-0 w-full focus:outline-none disabled:cursor-default"
        >
          <RawaqProductFrame variant="gallery" className="w-full shadow-[0_8px_30px_rgba(139,30,45,.06)] transition-shadow duration-500 group-hover:shadow-[0_12px_40px_rgba(139,30,45,.12)]">
            {imageUrl ? (
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-white">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.4)_0%,transparent_100%)]" />
                <Image
                  src={imageUrl}
                  alt={current?.alt || productName}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-contain p-6 transition-transform duration-700 ease-out group-hover:scale-[1.03] md:p-10"
                />
                <div className="absolute bottom-4 end-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#E9DDCC] bg-white/80 text-[#746A64] opacity-0 shadow-sm backdrop-blur-sm transition-all group-hover:translate-y-0 group-hover:opacity-100">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface-secondary)] text-[#A69A8C]">
                <span className="mb-4 text-5xl opacity-50">✦</span>
                <span className="text-sm font-bold uppercase tracking-wider">{isAr ? 'الصورة غير متوفرة' : 'Image unavailable'}</span>
              </div>
            )}
          </RawaqProductFrame>
        </button>

        {galleryImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={previousLabel}
              className="absolute start-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-stone-800 shadow-lg backdrop-blur transition hover:scale-105 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B7935F] sm:start-4"
            >
              <ArrowPrevious size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              aria-label={nextLabel}
              className="absolute end-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-stone-800 shadow-lg backdrop-blur transition hover:scale-105 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B7935F] sm:end-4"
            >
              <ArrowNext size={22} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {galleryImages.length > 1 && (
        <div className="flex max-w-full gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2" aria-label={isAr ? 'صور المنتج' : 'Product images'}>
          {galleryImages.map((image, index) => {
            const isSelected = current?.url === image.url;
            return (
              <button
                type="button"
                key={image.id || image.url}
                onClick={() => {
                  setSelectedUrl(image.url);
                  window.dispatchEvent(new CustomEvent('gallery-image-selected', { detail: { url: image.url } }));
                }}
                aria-label={`${isAr ? 'صورة' : 'Photo'} ${index + 1}${image.alt ? `: ${image.alt}` : ''}`}
                aria-pressed={isSelected}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all sm:h-24 sm:w-24 ${isSelected ? 'scale-[1.02] border-[#B7935F] bg-[#F7F3EA] shadow-[0_4px_12px_rgba(201,162,77,.2)]' : 'border-[#E9DDCC] bg-white hover:border-[#B7935F]/60 hover:bg-[#F7F3EA]'}`}
              >
                <Image
                  src={image.url.replace('local://', '/')}
                  alt={image.alt || `${productName} ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 80px, 96px"
                  className="object-contain p-2"
                />
              </button>
            );
          })}
        </div>
      )}

      {isLightboxOpen && imageUrl && (
        <div role="dialog" aria-modal="true" aria-label={productName} className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1F1B1A]/95 backdrop-blur-md" onClick={() => setIsLightboxOpen(false)}>
          <button type="button" onClick={() => setIsLightboxOpen(false)} className="absolute start-4 top-4 z-30 flex cursor-pointer items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-2 text-sm font-bold text-white shadow-2xl backdrop-blur-md transition-all hover:bg-white/30 active:scale-95 sm:start-6 sm:top-6 sm:px-5 sm:py-2.5 sm:text-base" aria-label={isAr ? 'الرجوع إلى صفحة المنتج' : 'Back to product page'}>
            {isAr ? <ArrowRight size={20} strokeWidth={2.5} aria-hidden="true" /> : <ChevronLeft size={20} strokeWidth={2.5} aria-hidden="true" />}
            <span>{isAr ? 'رجوع' : 'Back'}</span>
          </button>
          <button type="button" autoFocus onClick={() => setIsLightboxOpen(false)} className="absolute end-4 top-4 z-30 flex cursor-pointer items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-2 text-sm font-bold text-white shadow-2xl backdrop-blur-md transition-all hover:bg-white/30 active:scale-95 sm:end-6 sm:top-6 sm:px-5 sm:py-2.5 sm:text-base" aria-label={isAr ? 'إغلاق' : 'Close'}>
            <X size={20} strokeWidth={2.5} />
            <span>{isAr ? 'إغلاق' : 'Close'}</span>
          </button>
          {galleryImages.length > 1 && (
            <>
              <button type="button" onClick={event => { event.stopPropagation(); navigate(-1); }} aria-label={previousLabel} className="absolute start-3 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/15 text-white backdrop-blur hover:bg-white/25 sm:start-8">
                <ArrowPrevious size={26} aria-hidden="true" />
              </button>
              <button type="button" onClick={event => { event.stopPropagation(); navigate(1); }} aria-label={nextLabel} className="absolute end-3 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/15 text-white backdrop-blur hover:bg-white/25 sm:end-8">
                <ArrowNext size={26} aria-hidden="true" />
              </button>
            </>
          )}
          <div className="relative h-[85vh] w-full max-w-6xl px-4" onClick={event => event.stopPropagation()}>
            <Image src={imageUrl} alt={current?.alt || productName} fill sizes="100vw" className="object-contain" quality={100} />
          </div>
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 opacity-60">
            <span className="h-px w-8 bg-[#B7935F]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#B7935F]">{isAr ? 'رَواق' : 'RAWAQ'}</span>
            <span className="h-px w-8 bg-[#B7935F]" />
          </div>
        </div>
      )}
    </div>
  );
}
