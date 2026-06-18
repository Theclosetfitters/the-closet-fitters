'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

export default function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" className="text-muted hover:text-ink">
      Cart{ready && count > 0 ? ` (${count})` : ''}
    </Link>
  );
}
