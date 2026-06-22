import Image from 'next/image';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { listAllOrders, ORDER_STATUSES } from '@/lib/orders';
import { catalog } from '@/lib/catalog';
import { formatStatus } from '@/lib/format';
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
      <Image
        src="/images/CF_Secondary_Logo_.jpeg"
        alt="The Closet Fitters"
        width={1156}
        height={1114}
        className="mb-4 h-12 w-auto"
      />
      <h1 className="text-2xl font-bold text-ink">Orders</h1>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {counts.map((c) => (
          <div
            key={c.status}
            className="rounded-lg border border-line bg-card p-3 text-center"
          >
            <div className="text-lg font-bold text-ink">{c.count}</div>
            <div className="text-[11px] text-muted">
              {formatStatus(c.status)}
            </div>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="mt-8 text-muted">No orders yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} catalog={catalog}>
              <div className="space-y-2">
                <div className="rounded-lg bg-cream-50 p-2 text-xs text-muted">
                  <div className="font-medium text-ink">
                    {order.customerName ?? 'Guest'}
                    {order.quoteRef && (
                      <span className="ml-2 font-mono text-[10px] text-faint">
                        {order.quoteRef}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3">
                    {order.customerEmail && <span>{order.customerEmail}</span>}
                    {order.customerPhone && <span>{order.customerPhone}</span>}
                  </div>
                  {order.customerAddress && (
                    <div className="mt-0.5 text-muted">{order.customerAddress}</div>
                  )}
                  {order.referralSource && (
                    <div className="mt-1 text-muted">
                      <span className="text-faint">Referral source:</span>{' '}
                      {order.referralSource}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end">
                  <StatusControl orderId={order.id} status={order.status} />
                </div>
              </div>
            </OrderCard>
          ))}
        </div>
      )}
    </main>
  );
}
