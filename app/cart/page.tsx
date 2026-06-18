import { catalog } from '@/lib/catalog';
import CartView from '@/components/CartView';

export const metadata = { title: 'Your cart' };

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const { updated } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink">Your cart</h1>
      <p className="mt-1 text-sm text-muted">
        Review your closets, then continue to request your quote.
      </p>
      <CartView catalog={catalog} updated={updated === '1'} />
    </main>
  );
}
