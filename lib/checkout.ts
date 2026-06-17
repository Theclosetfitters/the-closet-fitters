// Pending-checkout store. When a Checkout Session is created we stash the
// configuration + server-computed price keyed by the Stripe session id.
// The webhook reads it back to create the real order ONLY after payment is
// verified (CLAUDE.md #2). The config never round-trips through the client.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClosetConfig, PriceBreakdown } from '@/types';

export interface PendingCheckout {
  sessionId: string;
  userId: string | null;
  config: ClosetConfig;
  priceBreakdown: PriceBreakdown;
  totalCents: number;
  currency: string;
  email: string | null;
}

export async function createPendingCheckout(
  supabase: SupabaseClient,
  pending: PendingCheckout
): Promise<void> {
  const { error } = await supabase.from('pending_checkouts').insert({
    session_id: pending.sessionId,
    user_id: pending.userId,
    config: pending.config,
    price_breakdown: pending.priceBreakdown,
    total_cents: pending.totalCents,
    currency: pending.currency,
    email: pending.email,
  });
  if (error) throw error;
}

export async function getPendingCheckout(
  supabase: SupabaseClient,
  sessionId: string
): Promise<PendingCheckout | null> {
  const { data, error } = await supabase
    .from('pending_checkouts')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    sessionId: data.session_id,
    userId: data.user_id,
    config: data.config,
    priceBreakdown: data.price_breakdown,
    totalCents: data.total_cents,
    currency: data.currency,
    email: data.email,
  };
}

export async function deletePendingCheckout(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  await supabase.from('pending_checkouts').delete().eq('session_id', sessionId);
}
