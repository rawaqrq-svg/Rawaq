import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/dal';

export default async function FulfillmentRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  await requirePermission('section:orders');
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  q.set('tab', 'PREPARING');
  redirect(`/admin/orders?${q.toString()}`);
}
