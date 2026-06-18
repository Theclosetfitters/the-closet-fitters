import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { listOrdersForUser } from '@/lib/orders';
import { catalog } from '@/lib/catalog';
import OrderCard from '@/components/OrderCard';

export const metadata = { title: 'My orders' };

export default async function AccountPage() {
  if (!isSupabaseConfigured()) {
    redirect('/login');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const orders = await listOrdersForUser(supabase, user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink">My orders</h1>
      <p className="mt-1 text-sm text-muted">{user.email}</p>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line p-8 text-center">
          <p className="text-muted">You don’t have any orders yet.</p>
          <Link
            href="/configure"
            className="mt-4 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-cream hover:bg-brand-700"
          >
            Design a closet
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} catalog={catalog} />
          ))}
        </div>
      )}
    </main>
  );
}
