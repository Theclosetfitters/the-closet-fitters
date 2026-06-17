// Order data-access helpers. The DB row uses snake_case; we map to the
// camelCase `Order` domain type.
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClosetConfig,
  Order,
  OrderStatus,
  PriceBreakdown,
} from '@/types';

export const ORDER_STATUSES: OrderStatus[] = [
  'received',
  'in_production',
  'ready',
  'completed',
];

interface OrderRow {
  id: string;
  user_id: string | null;
  config: ClosetConfig;
  price_breakdown: PriceBreakdown;
  total_cents: number;
  currency: string;
  status: OrderStatus;
  stripe_session_id: string | null;
  paid: boolean;
  customer_email: string | null;
  created_at: string;
  updated_at: string;
}

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    config: row.config,
    priceBreakdown: row.price_breakdown,
    totalCents: row.total_cents,
    currency: row.currency,
    status: row.status,
    stripeSessionId: row.stripe_session_id,
    paid: row.paid,
    customerEmail: row.customer_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Create an order. Call with a SERVICE-ROLE client from the Stripe webhook. */
export async function createOrder(
  supabase: SupabaseClient,
  input: {
    userId: string | null;
    config: ClosetConfig;
    priceBreakdown: PriceBreakdown;
    totalCents: number;
    currency: string;
    stripeSessionId: string;
    customerEmail: string | null;
  }
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      user_id: input.userId,
      config: input.config,
      price_breakdown: input.priceBreakdown,
      total_cents: input.totalCents,
      currency: input.currency,
      status: 'received',
      stripe_session_id: input.stripeSessionId,
      paid: true,
      customer_email: input.customerEmail,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToOrder(data as OrderRow);
}

/** True if an order already exists for this Stripe session (idempotency). */
export async function orderExistsForSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();
  return Boolean(data);
}

/** Orders belonging to a user (RLS restricts to own rows). */
export async function listOrdersForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as OrderRow[]).map(rowToOrder);
}

/** All orders (admin only — RLS admin policy or service role required). */
export async function listAllOrders(
  supabase: SupabaseClient
): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as OrderRow[]).map(rowToOrder);
}

/** Update an order's status (admin only). */
export async function updateOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw error;
}

/**
 * Store a checkout quote as one order row per closet. Call with a SERVICE-ROLE
 * client. Payment is not collected; orders start at 'received', unpaid.
 */
export async function createQuoteOrders(
  supabase: SupabaseClient,
  input: {
    quoteRef: string;
    userId: string | null;
    contact: { name: string; phone: string; email: string; address: string };
    closets: { config: ClosetConfig; breakdown: PriceBreakdown; totalCents: number }[];
  }
): Promise<void> {
  const rows = input.closets.map((c) => ({
    user_id: input.userId,
    config: c.config,
    price_breakdown: c.breakdown,
    total_cents: c.totalCents,
    currency: c.breakdown.currency,
    status: 'received',
    paid: false,
    customer_email: input.contact.email,
    customer_name: input.contact.name,
    customer_phone: input.contact.phone,
    customer_address: input.contact.address,
    quote_ref: input.quoteRef,
  }));
  const { error } = await supabase.from('orders').insert(rows);
  if (error) throw error;
}
