'use client';

import Link from 'next/link';
import type { Catalog } from '@/types';
import { useCart } from '@/lib/cart-context';
import { formatCents } from '@/lib/format';
import ClosetSummary from '@/components/ClosetSummary';

export default function CartView({ catalog }: { catalog: Catalog }) {
  const { items, remove, totalCents, ready } = useCart();

  if (!ready) {
    return <p className="mt-8 text-faint">Loading your cart…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-line p-8 text-center">
        <p className="text-muted">Your cart is empty.</p>
        <Link
          href="/configure"
          className="mt-4 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-cream hover:bg-brand-700"
        >
          Design a closet
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {items.map((item, i) => (
        <div key={item.id} className="space-y-2">
          <ClosetSummary
            catalog={catalog}
            config={item.config}
            totalCents={item.totalCents}
            index={i}
          />
          <div className="text-right">
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="text-xs text-muted hover:text-red-600"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between rounded-xl border border-line bg-card p-4">
        <span className="font-semibold text-ink">Estimated total</span>
        <span className="text-lg font-bold tabular-nums text-walnut">
          {formatCents(totalCents)}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Link
          href="/configure"
          className="rounded-full border border-line px-6 py-2.5 text-center text-sm font-semibold text-ink hover:bg-card"
        >
          + Add another closet
        </Link>
        <Link
          href="/checkout"
          className="rounded-full bg-brand px-8 py-2.5 text-center text-sm font-semibold text-cream hover:bg-brand-700"
        >
          Proceed to checkout
        </Link>
      </div>
    </div>
  );
}
