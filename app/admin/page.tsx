import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { listAllOrders, ORDER_STATUSES } from '@/lib/orders';
import { catalog } from '@/lib/catalog';
import { formatCents, formatStatus } from '@/lib/format';
import OrderCard from '@/components/OrderCard';
import StatusControl from '@/components/admin/StatusControl';

export const metadata = { title: 'Admin · Orders' };

// Force dynamic — this page is per-request and admin-gated.
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Server-side admin enforcement on every request (CLAUDE.md #3).
  await requireAdmin();

  const supabase = await createClient();
  const orders = await listAllOrders(supabase);

  const counts = ORDER_STATUSES.map((s) => ({
    status: s,
    count: orders.filter((o) => o.status === s).length,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900">Orders</h1>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {counts.map((c) => (
          <div
            key={c.status}
            className="rounded-lg border border-zinc-200 bg-white p-3 text-center"
          >
            <div className="text-lg font-bold text-zinc-900">{c.count}</div>
            <div className="text-[11px] text-zinc-500">
              {formatStatus(c.status)}
            </div>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="mt-8 text-zinc-500">No orders yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} catalog={catalog}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  {order.customerEmail ?? 'Guest'} ·{' '}
                  {formatCents(order.totalCents, order.currency)}
                </span>
                <StatusControl orderId={order.id} status={order.status} />
              </div>
            </OrderCard>
          ))}
        </div>
      )}
    </main>
  );
}
