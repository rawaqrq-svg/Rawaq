'use server';

import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/dal';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const dateOrNull = (value: FormDataEntryValue | null, endOfDay = false) => {
  if (!value) return null;
  const valueString = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueString)) return new Date(Number.NaN);
  const calendarDate = new Date(`${valueString}T00:00:00.000Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== valueString) return new Date(Number.NaN);
  const startOfDay = new Date(`${valueString}T00:00:00.000+03:00`);
  return endOfDay ? new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1) : startOfDay;
};

export type RewardRuleActionState = { status: 'idle' | 'success' | 'error'; message: string; details?: string[] };

export async function saveRewardRule(_previousState: RewardRuleActionState, formData: FormData): Promise<RewardRuleActionState> {
  await requirePermission('manage:settings');
  const schema = z.object({
    name: z.string().trim().min(2).max(100), minimumAmount: z.coerce.number().min(0),
    rewardType: z.enum(['FREE_DELIVERY', 'PERCENT', 'FIXED', 'FREE_PRODUCT']), rewardValue: z.coerce.number().min(0).default(0),
    usageLimit: z.union([z.literal(''), z.coerce.number().int().positive()]),
    priority: z.coerce.number().int().min(-10000).max(10000).default(0),
    giftVariantIds: z.string().max(20000).default('[]'), giftSelectionMode: z.enum(['FIXED', 'CUSTOMER_CHOICE']).default('FIXED'),
    id: z.string().uuid().optional(),
  }).refine(data => data.rewardType !== 'PERCENT' || (Number.isInteger(data.rewardValue) && data.rewardValue >= 1 && data.rewardValue <= 100), { message: 'يجب أن تكون نسبة الخصم عددًا صحيحًا من 1 إلى 100.' });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldNames: Record<string, string> = { name: 'اسم المكافأة', minimumAmount: 'الحد الأدنى للسلة', rewardType: 'نوع المكافأة', rewardValue: 'قيمة الخصم', usageLimit: 'حد الاستبدال', priority: 'الأولوية' };
    const details = [...new Set(parsed.error.issues.map(issue => fieldNames[String(issue.path[0])] ?? issue.message))];
    return { status: 'error', message: 'لم تُحفظ المكافأة. راجعي الحقول الموضحة أدناه.', details };
  }
  const data = parsed.data;
  const startsAt = dateOrNull(formData.get('startsAt'));
  const endsAt = dateOrNull(formData.get('endsAt'), true);
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) return { status: 'error', message: 'أدخلي تاريخًا صحيحًا لبداية العرض أو نهايته.' };
  if (startsAt && endsAt && startsAt >= endsAt) return { status: 'error', message: 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البداية.' };
  let giftVariantIds: string[];
  try {
    const parsedIds: unknown = JSON.parse(data.giftVariantIds);
    if (!Array.isArray(parsedIds) || parsedIds.some(id => typeof id !== 'string' || !z.string().uuid().safeParse(id).success)) return { status: 'error', message: 'تعذر التحقق من المنتجات المحددة كهدية. حدّثي الصفحة وحاولي مجددًا.' };
    giftVariantIds = [...new Set(parsedIds as string[])];
  } catch { return { status: 'error', message: 'تعذر قراءة المنتجات المحددة كهدية.' }; }
  if (data.rewardType === 'FREE_PRODUCT') {
    if (giftVariantIds.length < 1 || (data.giftSelectionMode === 'FIXED' && giftVariantIds.length !== 1)) return { status: 'error', message: data.giftSelectionMode === 'FIXED' ? 'اختاري منتجًا واحدًا للهدية المحددة.' : 'اختاري منتجًا واحدًا على الأقل لتعرضيها ضمن خيارات العميلة.' };
    const validVariants = await prisma.productVariant.findMany({ where: { id: { in: giftVariantIds }, isActive: true, product: { isVisible: true }, OR: [{ inventorySource: 'INTERNAL' }, { inventorySource: 'SUPPLIER', supplierOffers: { some: { isActive: true, supplier: { isActive: true } } } }] }, select: { id: true } });
    if (validVariants.length !== giftVariantIds.length) return { status: 'error', message: 'تغيّر توفر أحد المنتجات المحددة. أزيليه من القائمة واختاري منتجًا متاحًا.' };
  } else {
    giftVariantIds = [];
  }
  const update = {
    name: data.name, minimumAmount: Math.round(data.minimumAmount * 1000), rewardType: data.rewardType,
    rewardValue: data.rewardType === 'FIXED' ? Math.round(data.rewardValue * 1000) : Math.round(data.rewardValue),
    usageLimit: data.usageLimit === '' ? null : data.usageLimit,
    priority: data.priority, startsAt, endsAt,
    giftVariantIds: JSON.stringify(giftVariantIds), giftSelectionMode: data.giftSelectionMode,
  };
  try {
    if (data.id) await prisma.rewardRule.update({ where: { id: data.id }, data: update });
    else await prisma.rewardRule.create({ data: update });
  } catch {
    return { status: 'error', message: 'لم نتمكن من حفظ المكافأة بسبب مشكلة في الاتصال. حاولي مرة أخرى.' };
  }
  revalidatePath('/admin/rewards');
  revalidatePath('/api/cart-rewards');
  return { status: 'success', message: data.id ? 'تم حفظ تحديثات المكافأة.' : 'تم إنشاء المكافأة بنجاح.' };
}

export async function toggleRewardRule(id: string, active: boolean) {
  await requirePermission('manage:settings');
  await prisma.rewardRule.update({ where: { id }, data: { isActive: active } });
  revalidatePath('/admin/rewards');
}

export async function saveCoupon(formData: FormData) {
  await requirePermission('manage:settings');
  const schema = z.object({
    code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/), name: z.string().trim().max(100).optional(),
    discountType: z.enum(['PERCENT', 'FIXED', 'FREE_DELIVERY']), discountValue: z.coerce.number().min(0),
    minimumOrderAmount: z.coerce.number().min(0), maximumDiscount: z.union([z.literal(''), z.coerce.number().min(0)]),
    usageLimit: z.union([z.literal(''), z.coerce.number().int().positive()]),
    perCustomerLimit: z.union([z.literal(''), z.coerce.number().int().positive()]),
    productIds: z.string().optional(), categoryIds: z.string().optional(), brandIds: z.string().optional(),
  }).refine(data => data.discountType !== 'PERCENT' || (Number.isInteger(data.discountValue) && data.discountValue <= 100));
  const couponFields = Object.fromEntries(formData);
  couponFields.productIds = formData.getAll('productIds').map(String).join(',');
  couponFields.categoryIds = formData.getAll('categoryIds').map(String).join(',');
  couponFields.brandIds = formData.getAll('brandIds').map(String).join(',');
  const parsed = schema.safeParse(couponFields);
  if (!parsed.success) return;
  const data = parsed.data;
  const targets = [
    ...String(data.productIds || '').split(',').map(id => ({ id: id.trim(), type: 'PRODUCT' })),
    ...String(data.categoryIds || '').split(',').map(id => ({ id: id.trim(), type: 'CATEGORY' })),
    ...String(data.brandIds || '').split(',').map(id => ({ id: id.trim(), type: 'BRAND' })),
  ].filter(target => target.id.length > 0);
  const startsAt = dateOrNull(formData.get('startsAt'));
  const endsAt = dateOrNull(formData.get('endsAt'), true);
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime())) || (startsAt && endsAt && startsAt >= endsAt)) return;
  const [validProducts, validCategories, validBrands] = await Promise.all([
    prisma.product.count({ where: { id: { in: targets.filter(t => t.type === 'PRODUCT').map(t => t.id) } } }),
    prisma.category.count({ where: { id: { in: targets.filter(t => t.type === 'CATEGORY').map(t => t.id) } } }),
    prisma.brand.count({ where: { id: { in: targets.filter(t => t.type === 'BRAND').map(t => t.id) } } }),
  ]);
  if (validProducts !== targets.filter(t => t.type === 'PRODUCT').length || validCategories !== targets.filter(t => t.type === 'CATEGORY').length || validBrands !== targets.filter(t => t.type === 'BRAND').length) return;
  await prisma.coupon.create({ data: {
    code: data.code.toUpperCase(), name: data.name || null, discountType: data.discountType,
    discountValue: data.discountType === 'FIXED' ? Math.round(data.discountValue * 1000) : Math.round(data.discountValue),
    minimumOrderAmount: Math.round(data.minimumOrderAmount * 1000),
    maximumDiscount: data.maximumDiscount === '' ? null : Math.round(data.maximumDiscount * 1000),
    usageLimit: data.usageLimit === '' ? null : data.usageLimit,
    perCustomerLimit: data.perCustomerLimit === '' ? null : data.perCustomerLimit,
    startsAt, endsAt,
    targets: { create: targets.map(target => ({ targetType: target.type, targetId: target.id })) },
  } });
  revalidatePath('/admin/coupons');
}

export async function toggleCoupon(id: string, active: boolean) {
  await requirePermission('manage:settings');
  await prisma.coupon.update({ where: { id }, data: { isActive: active } });
  revalidatePath('/admin/coupons');
}
