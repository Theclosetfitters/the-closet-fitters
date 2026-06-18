'use client';

import Link from 'next/link';
import type { PriceBreakdown } from '@/types';
import { formatCents } from '@/lib/format';

interface Props {
  breakdown: PriceBreakdown | null;
  loading: boolean;
  onAddToCart: () => void;
  added: boolean;
  cartCount: number;
}

export default function PricePanel({
  breakdown,
  loading,
  onAddToCart,
  added,
  cartCount,
}: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-800">Your quote</h3>
        {loading && <span className="text-xs text-zinc-400">updating…</span>}
      </div>

      <dl className="mt-3 space-y-1.5">
        {breakdown?.lineItems.map((li, i) => (
          <div key={i} className="flex justify-between text-sm">
            <dt className="text-zinc-600">{li.label}</dt>
            <dd className="tabular-nums text-zinc-800">
              {formatCents(li.amountCents, breakdown.currency)}
            </dd>
          </div>
        ))}
        {!breakdown && (
          <div className="text-sm text-zinc-400">Calculating…</div>
        )}
      </dl>

      <div className="mt-3 flex justify-between border-t border-zinc-200 pt-3">
        <span className="font-semibold text-zinc-900">Total</span>
        <span
          data-testid="price-total"
          className="text-lg font-bold tabular-nums text-walnut"
        >
          {breakdown
            ? formatCents(breakdown.totalCents, breakdown.currency)
            : '—'}
        </span>
      </div>

      <button
        type="button"
        data-testid="add-to-cart"
        onClick={onAddToCart}
        disabled={!breakdown}
        className="mt-4 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {added ? 'Added to cart ✓' : 'Add to cart'}
      </button>
      {cartCount > 0 && (
        <Link
          href="/cart"
          className="mt-2 block text-center text-sm font-medium text-walnut hover:underline"
        >
          View cart ({cartCount}) →
        </Link>
      )}
      <p className="mt-2 text-center text-[11px] text-zinc-400">
        Price is calculated securely on our server.
      </p>
    </div>
  );
}
