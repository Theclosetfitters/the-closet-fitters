import { catalog } from '@/lib/catalog';
import CheckoutForm from '@/components/CheckoutForm';

export const metadata = { title: 'Checkout' };

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink">Request your quote</h1>
      <p className="mt-1 text-sm text-muted">
        Tell us where to send it. We’ll email an itemized quote with a sketch of
        each closet — no payment required.
      </p>
      <CheckoutForm catalog={catalog} />
    </main>
  );
}
