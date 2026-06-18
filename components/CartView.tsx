'use client';

import Link from 'next/link';
import type { Catalog } from '@/types';
import { useCart } from '@/lib/cart-context';
import { formatCents } from '@/lib/format';
import ClosetSummary from '@/components/ClosetSummary';

export default function CartView({ catalog }: { catalog: Catalog }) {
  const { items, remove, totalCents, ready } = useCart();

  if (!ready) {
    return <p className="mt-8 text-zinc-400">Loading your cart…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center">
        <p className="text-zinc-500">Your cart is empty.</p>
        <Link
          href="/configure"
          className="mt-4 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
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
              className="text-xs text-zinc-500 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4">
        <span className="font-semibold text-zinc-900">Estimated total</span>
        <span className="text-lg font-bold tabular-nums text-walnut">
          {formatCents(totalCents)}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Link
          href="/configure"
          className="rounded-full border border-zinc-300 px-6 py-2.5 text-center text-sm font-semibold text-zinc-700 hover:bg-white"
        >
          + Add another closet
        </Link>
        <Link
          href="/checkout"
          className="rounded-full bg-brand px-8 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
        >
          Proceed to checkout
        </Link>
      </div>
    </div>
  );
}
