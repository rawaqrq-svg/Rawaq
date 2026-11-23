import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/dal';

const typeOptions = ['FREE_PRODUCT', 'FREE_DELIVERY', 'PERCENT', 'FIXED'] as const;
const typeLabels: Record<string, string> = { FREE_PRODUCT: 'منتج هدية', FREE_DELIVERY: 'توصيل مجاني', PERCENT: 'خصم بنسبة', FIXED: 'خصم ثابت' };
const statusLabels: Record<string, string> = { PENDING: 'بانتظار التأكيد', AWAITING_WHATSAPP: 'بانتظار واتساب', PROCESSING: 'قيد التجهيز', PARTIALLY_READY: 'جاهز جزئيًا', DELIVERED: 'تم التوصيل', COMPLETED: 'مكتمل', CANCELLED: 'ملغي', REFUNDED: 'مسترد' };

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}
function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function addDays(date: string, count: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + count);
  return parsed.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  await requirePermission('manage:settings');
  const params = new URL(request.url).searchParams;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
  const fromInput = params.get('from');
  const toInput = params.get('to');
  const from = validDate(fromInput) ? fromInput! : addDays(today, -29);
  const to = validDate(toInput) ? toInput! : today;
  if (from > to) return NextResponse.json({ error: 'تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.' }, { status: 400 });

  const selectedType = params.get('type') ?? 'ALL';
  const selectedState = params.get('state') ?? 'ALL';
  const type = (typeOptions as readonly string[]).includes(selectedType) ? selectedType : 'ALL';
  const state = ['ACTIVE', 'VOIDED'].includes(selectedState) ? selectedState : 'ALL';
  const query = (params.get('q') ?? '').trim().slice(0, 100);
  const where = {
    createdAt: { gte: new Date(`${from}T00:00:00.000+03:00`), lt: new Date(`${addDays(to, 1)}T00:00:00.000+03:00`) },
    ...(state === 'ACTIVE' ? { isVoided: false } : state === 'VOIDED' ? { isVoided: true } : {}),
    ...(type === 'ALL' ? {} : { rewardRule: { rewardType: type } }),
    ...(query ? { OR: [
      { order: { reference: { contains: query, mode: 'insensitive' as const } } },
      { order: { customerName: { contains: query, mode: 'insensitive' as const } } },
      { rewardRule: { name: { contains: query, mode: 'insensitive' as const } } },
    ] } : {}),
  };
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode('\uFEFF' + ['التاريخ', 'اسم العميلة', 'رقم الطلب', 'حالة الطلب', 'اسم المكافأة', 'نوع المكافأة', 'حالة الاستبدال', 'قيمة الخصم أو الهدية', 'الهدية المختارة', 'قيمة الطلب'].map(csvCell).join(',') + '\r\n'));
      let cursor: string | undefined;
      try {
        while (true) {
          const rows = await prisma.rewardRedemption.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 500,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: { id: true, amount: true, isVoided: true, giftNameSnapshot: true, createdAt: true, rewardRule: { select: { name: true, rewardType: true } }, order: { select: { reference: true, customerName: true, status: true, totalAmount: true } } },
          });
          if (rows.length === 0) break;
          const lines = rows.map(row => [
            row.createdAt.toISOString(), row.order.customerName, row.order.reference, statusLabels[row.order.status] ?? row.order.status,
            row.rewardRule.name, typeLabels[row.rewardRule.rewardType] ?? row.rewardRule.rewardType, row.isVoided ? 'ملغى / مسترد' : 'محتسب',
            row.amount, row.giftNameSnapshot, row.order.totalAmount,
          ].map(csvCell).join(',')).join('\r\n') + '\r\n';
          controller.enqueue(encoder.encode(lines));
          cursor = rows.at(-1)!.id;
          if (rows.length < 500) break;
        }
        controller.close();
      } catch {
        controller.error(new Error('تعذر إنشاء تقرير الاستبدالات.'));
      }
    },
  });
  return new Response(stream, { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="reward-redemptions.csv"',
    'Cache-Control': 'no-store',
  } });
}
