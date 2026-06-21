'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

// Cart nav item: shopping-bag icon (22px) with the item-count badge preserved.
export default function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link
      href="/cart"
      title="Cart"
      aria-label={ready && count > 0 ? `Cart (${count})` : 'Cart'}
      className="relative text-cream/72 transition hover:text-cream"
    >
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1 -2.966 2.544h-6.852a3 3 0 0 1 -2.966 -2.544l-1.255 -8.152a2 2 0 0 1 1.977 -2.304z" />
        <path d="M9 11v-5a3 3 0 0 1 6 0v5" />
      </svg>
      {ready && count > 0 && (
        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sand px-1 text-[10px] font-bold leading-none text-brand">
          {count}
        </span>
      )}
    </Link>
  );
}
