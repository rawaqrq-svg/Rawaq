import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FloatingCart } from '@/components/FloatingCart';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { prisma } from '@/lib/db';
import React from 'react';

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const dir = locale === 'en' ? 'ltr' : 'rtl';

  // These independent layout reads can run together on a cold navigation.
  const [activeReward, rootHeaderCategories, promoVariant] = await Promise.all([
    prisma.rewardRule.findFirst({
      where: { isActive: true, minimumAmount: { gt: 0 } },
      orderBy: { minimumAmount: 'asc' },
    }),
    prisma.category.findMany({
    where: { isVisible: true, parentId: null },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      sortOrder: true,
      children: {
        where: { isVisible: true },
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          children: {
            where: { isVisible: true },
            select: {
              id: true,
              name: true,
              slug: true,
              parentId: true,
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
    }),
    prisma.productVariant.findFirst({
    where: {
      isActive: true,
      compareAt: { not: null },
      product: { isVisible: true },
    },
    select: {
      price: true,
      compareAt: true,
    },
    }),
  ]);
  const hasActiveOffers = Boolean(promoVariant && promoVariant.compareAt && promoVariant.compareAt > promoVariant.price);

  return (
    <div data-brand="rawaq" className="rawaq-storefront flex flex-col min-h-screen" dir={dir} lang={locale}>
      <AnnouncementBar locale={locale} />
      <Header categories={rootHeaderCategories} hasActiveOffers={hasActiveOffers} />
      <div className="flex-grow flex-1 bg-[var(--surface-primary)]">
        {children}
      </div>
      <Footer locale={locale} />
      <FloatingCart locale={locale} rewardRule={activeReward} />
    </div>
  );
}
