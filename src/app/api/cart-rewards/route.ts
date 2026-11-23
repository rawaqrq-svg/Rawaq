import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const now = new Date();
  const rules = await prisma.rewardRule.findMany({
    where: { isActive: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ] },
    select: { id: true, name: true, minimumAmount: true, rewardType: true, rewardValue: true, usageLimit: true, usageCount: true, giftVariantIds: true, giftSelectionMode: true },
    orderBy: { minimumAmount: 'asc' },
  });
  const giftIds = [...new Set(rules.filter(rule => rule.rewardType === 'FREE_PRODUCT').flatMap(rule => {
    try { return JSON.parse(rule.giftVariantIds) as string[]; } catch { return []; }
  }))];
  const giftVariants = giftIds.length ? await prisma.productVariant.findMany({
    where: { id: { in: giftIds }, isActive: true, product: { isVisible: true }, OR: [{ inventorySource: 'INTERNAL' }, { inventorySource: 'SUPPLIER', supplierOffers: { some: { isActive: true, supplier: { isActive: true } } } }] },
    select: { id: true, sku: true, size: true, price: true, colorName: true, mainImage: true, product: { select: { id: true, nameAr: true, nameEn: true, images: { where: { isMain: true }, select: { url: true }, take: 1 } } } },
  }) : [];
  const giftById = new Map(giftVariants.map(variant => [variant.id, variant]));
  const available = rules.map(({ usageLimit, usageCount, giftVariantIds, ...rule }) => ({
    ...rule,
    usageLimit,
    usageCount,
    giftVariants: rule.rewardType === 'FREE_PRODUCT'
      ? (() => { try { return (JSON.parse(giftVariantIds) as string[]).map(id => giftById.get(id)).filter(Boolean); } catch { return []; } })()
      : [],
  })).filter(rule => rule.rewardType !== 'FREE_PRODUCT' || rule.giftVariants.length > 0)
    .filter(rule => rule.usageLimit === null || rule.usageCount < rule.usageLimit)
    .map(({ usageLimit: _usageLimit, usageCount: _usageCount, ...rule }) => rule);
  return NextResponse.json({ rules: available }, { headers: { 'Cache-Control': 'no-store' } });
}
