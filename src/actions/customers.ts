'use server';

import { requireSuperAdmin } from '@/lib/dal';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function updateCustomerNotes(customerId: string, notes: string) {
  await requireSuperAdmin();

  await prisma.customer.update({
    where: { id: customerId },
    data: { notes }
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath('/admin/customers');
}

export async function toggleCustomerStatus(customerId: string, isActive: boolean) {
  await requireSuperAdmin();

  await prisma.customer.update({
    where: { id: customerId },
    data: { isActive }
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath('/admin/customers');
}
