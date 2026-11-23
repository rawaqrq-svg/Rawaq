'use server';

import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/dal';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { normalizeCourierCompany } from '@/lib/delivery/courier-pricing';

const tiersSchema = z.array(z.object({
  minLocations: z.number().int().min(1).max(10000),
  maxLocations: z.number().int().min(1).max(10000).nullable(),
  costJod: z.number().finite().min(0).max(100000),
})).min(1).max(50);

function todayInRiyadh() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export async function createDeliveryTariffVersionAction(input: {
  companyName: string;
  effectiveFrom: string;
  note?: string;
  tiers: unknown;
}) {
  const session = await requirePermission('manage:settings');
  const parsed = z.object({
    companyName: z.string().trim().min(2).max(120),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().trim().max(300).optional(),
    tiers: tiersSchema,
  }).safeParse(input);
  if (!parsed.success) return { success: false as const, error: 'تحقق من اسم الشركة والشرائح والأسعار.' };

  const tiers = [...parsed.data.tiers].sort((a, b) => a.minLocations - b.minLocations);
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (tier.maxLocations !== null && tier.maxLocations < tier.minLocations) return { success: false as const, error: 'الحد الأعلى يجب أن يساوي الحد الأدنى أو يزيد عليه.' };
    if (i > 0) {
      const previous = tiers[i - 1];
      if (previous.maxLocations === null || tier.minLocations <= previous.maxLocations) return { success: false as const, error: 'توجد شرائح متداخلة. عدّل الحدود حتى لا يتكرر عدد المحلات.' };
    }
  }
  const today = todayInRiyadh();
  if (parsed.data.effectiveFrom < today) return { success: false as const, error: 'لا يمكن إنشاء تعرفة بتاريخ سابق؛ اختر اليوم أو تاريخاً لاحقاً.' };
  const effectiveFrom = new Date(`${parsed.data.effectiveFrom}T00:00:00+03:00`);
  const companyKey = normalizeCourierCompany(parsed.data.companyName);

  try {
    await prisma.$transaction(async tx => {
      const existingDate = await tx.deliveryTariffVersion.findUnique({ where: { companyKey_effectiveFrom: { companyKey, effectiveFrom } }, select: { id: true } });
      if (existingDate) throw new Error('توجد نسخة تعرفة لهذه الشركة في تاريخ السريان نفسه.');
      const previous = await tx.deliveryTariffVersion.findFirst({ where: { companyKey, effectiveFrom: { lte: effectiveFrom } }, include: { tiers: true }, orderBy: { effectiveFrom: 'desc' } });
      const current = await tx.deliveryTariffVersion.create({
        data: {
          companyName: parsed.data.companyName,
          companyKey,
          effectiveFrom,
          note: parsed.data.note || null,
          createdByEmployeeId: session.employeeId,
          tiers: { create: tiers.map(tier => ({ minLocations: tier.minLocations, maxLocations: tier.maxLocations, costFils: Math.round(tier.costJod * 1000) })) },
        },
        include: { tiers: true },
      });
      await tx.auditLog.create({ data: {
        employeeId: session.employeeId,
        action: 'COURIER_TARIFF_VERSION_CREATED',
        entityType: 'DeliveryTariffVersion',
        entityId: current.id,
        details: JSON.stringify({ companyName: current.companyName, effectiveFrom: current.effectiveFrom, previous: previous ? { effectiveFrom: previous.effectiveFrom, tiers: previous.tiers } : null, current: current.tiers }),
      } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/settings/delivery-pricing');
    revalidatePath('/admin/settings');
    revalidatePath('/admin/reconciliation');
    return { success: true as const };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'تعذر حفظ إصدار التعرفة.' };
  }
}
