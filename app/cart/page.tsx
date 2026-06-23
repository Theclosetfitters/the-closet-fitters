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
    <main className="w-full flex-1" style={{ background: '#F8F4F0' }}>
      <CartView catalog={catalog} updated={updated === '1'} />
    </main>
  );
}
