import { requirePermission } from '@/lib/dal';
import { redirect } from 'next/navigation';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('section:orders');
  const { id } = await params;
  redirect(`/admin/orders?orderId=${id}`);
}
