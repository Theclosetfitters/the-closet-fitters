import { catalog } from '@/lib/catalog';
import CartView from '@/components/CartView';

export const metadata = { title: 'Your cart' };

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900">Your cart</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Review your closets, then continue to request your quote.
      </p>
      <CartView catalog={catalog} />
    </main>
  );
}
