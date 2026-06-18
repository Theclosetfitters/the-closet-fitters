'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

export default function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" className="text-cream/80 transition hover:text-cream">
      Cart{ready && count > 0 ? ` (${count})` : ''}
    </Link>
  );
}
