'use server';

// Server action to advance an order's status. Re-checks admin on the server
// (CLAUDE.md #3) — the UI being reachable is never sufficient authorization.
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ORDER_STATUSES, updateOrderStatus } from '@/lib/orders';
import type { OrderStatus } from '@/types';

export async function updateOrderStatusAction(formData: FormData) {
  await requireAdmin();

  const orderId = String(formData.get('orderId') ?? '');
  const status = String(formData.get('status') ?? '') as OrderStatus;

  if (!orderId || !ORDER_STATUSES.includes(status)) {
    throw new Error('Invalid order or status');
  }

  const supabase = await createClient();
  await updateOrderStatus(supabase, orderId, status);
  revalidatePath('/admin');
}
