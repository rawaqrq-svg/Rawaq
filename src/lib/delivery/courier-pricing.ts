import type { Prisma } from '@prisma/client';

export function normalizeCourierCompany(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');
}

export type CourierTier = { minLocations: number; maxLocations: number | null; costFils: number };

export function resolveCourierTierCost(tiers: CourierTier[], locationCount: number) {
  const tier = tiers.find(item => item.minLocations <= locationCount && (item.maxLocations === null || locationCount <= item.maxLocations));
  return tier?.costFils ?? null;
}

export async function getPickupLocationCount(tx: Prisma.TransactionClient, orderIds: string[]) {
  const orders = await tx.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      fulfillmentOrders: { where: { status: { not: 'CANCELLED' } }, select: { locationId: true, supplierId: true } },
      items: { select: { supplierIdSnapshot: true } },
    },
  });
  const locations = new Set<string>();
  for (const order of orders) {
    if (order.fulfillmentOrders.length) {
      for (const pickup of order.fulfillmentOrders) locations.add(pickup.locationId || pickup.supplierId);
      continue;
    }
    const suppliers = [...new Set(order.items.map(item => item.supplierIdSnapshot).filter(Boolean))] as string[];
    if (suppliers.length) suppliers.forEach(id => locations.add(`supplier:${id}`));
    else locations.add('rawaq:central');
  }
  return locations.size;
}

export async function getCourierTariffForDate(
  tx: Prisma.TransactionClient,
  companyName: string,
  at: Date,
) {
  const companyKey = normalizeCourierCompany(companyName);
  if (!companyKey) return null;
  return tx.deliveryTariffVersion.findFirst({
    where: { companyKey, effectiveFrom: { lte: at } },
    include: { tiers: { orderBy: { minLocations: 'asc' } } },
    orderBy: { effectiveFrom: 'desc' },
  });
}

export async function recordCompletedBatchTariffCost(tx: Prisma.TransactionClient, batchId: string, employeeId?: string | null) {
  const batch = await tx.deliveryBatch.findUnique({ where: { id: batchId }, select: {
    id: true, reference: true, tariffEvaluatedAt: true, carrierTariffCostFils: true,
    orders: { select: { id: true } },
  } });
  if (!batch || !batch.tariffEvaluatedAt) return;
  const batchCostKey = `delivery-batch-cost:${batch.id}`;
  if (await tx.financialTransaction.findUnique({ where: { businessEventKey: batchCostKey }, select: { id: true } })) return;

  const legacyCosts = await tx.financialTransaction.findMany({
    where: { type: 'DELIVERY_COST', orderId: { in: batch.orders.map(order => order.id) } },
    select: { id: true, orderId: true, amount: true },
  });
  for (const legacy of legacyCosts) {
    const reversalKey = `delivery-batch-cost:${batch.id}:reverse:${legacy.id}`;
    if (await tx.financialTransaction.findUnique({ where: { businessEventKey: reversalKey }, select: { id: true } })) continue;
    await tx.financialTransaction.create({ data: {
      businessEventKey: reversalKey, type: 'DELIVERY_COST_REVERSAL', direction: 'IN', amount: legacy.amount,
      orderId: legacy.orderId, description: `عكس تكلفة توصيل فردية عند تطبيق تعرفة الطلبية ${batch.reference}`,
      createdByEmployeeId: employeeId || null,
    } });
  }

  if ((batch.carrierTariffCostFils ?? 0) > 0) {
    await tx.financialTransaction.create({ data: {
      businessEventKey: batchCostKey, type: 'DELIVERY_COST', direction: 'OUT', amount: batch.carrierTariffCostFils!,
      description: `تكلفة رحلة شركة التوصيل للطلبية ${batch.reference}`,
      createdByEmployeeId: employeeId || null,
    } });
  }
}
