import { prisma } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const order = await prisma.order.findUnique({
    where: { reference: decodeURIComponent(reference) },
    select: { status: true, fulfillmentStatus: true },
  });

  if (!order) {
    return Response.json({ found: false }, { status: 404 });
  }

  return Response.json(
    { found: true, status: order.status, fulfillmentStatus: order.fulfillmentStatus },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
