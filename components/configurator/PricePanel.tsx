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
  /** When true, the CTA replaces an existing cart item instead of adding one. */
  editMode?: boolean;
  onUpdate?: () => void;
}

export default function PricePanel({
  breakdown,
  loading,
  onAddToCart,
  added,
  cartCount,
  editMode = false,
  onUpdate,
}: Props) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Your quote</h3>
        {loading && <span className="text-xs text-faint">updating…</span>}
      </div>

      <dl className="mt-3 space-y-1.5">
        {breakdown?.lineItems.map((li, i) => (
          <div key={i} className="flex justify-between text-sm">
            <dt className="text-muted">{li.label}</dt>
            <dd className="tabular-nums text-ink">
              {formatCents(li.amountCents, breakdown.currency)}
            </dd>
          </div>
        ))}
        {!breakdown && (
          <div className="text-sm text-faint">Calculating…</div>
        )}
      </dl>

      <div className="mt-3 flex justify-between border-t border-line pt-3">
        <span className="font-semibold text-ink">Total</span>
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
        data-testid={editMode ? 'update-closet' : 'add-to-cart'}
        onClick={editMode ? onUpdate : onAddToCart}
        disabled={!breakdown}
        className="mt-4 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-cream transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {editMode ? 'Update Closet' : added ? 'Added to cart ✓' : 'Add to cart'}
      </button>
      {editMode ? (
        <Link
          href="/cart"
          className="mt-3 block text-center text-sm text-muted hover:text-ink hover:underline"
        >
          Cancel — back to cart
        </Link>
      ) : (
        cartCount > 0 && (
          <Link
            href="/cart"
            className="mt-2 block text-center text-sm font-medium text-walnut hover:underline"
          >
            View cart ({cartCount}) →
          </Link>
        )
      )}
      <p className="mt-2 text-center text-[11px] text-faint">
        Price is calculated securely on our server.
      </p>
    </div>
  );
}
