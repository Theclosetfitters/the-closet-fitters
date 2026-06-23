import Link from 'next/link';

export const metadata = { title: 'Order confirmed' };

// The success redirect is for UX only. The order is created by the verified
// Stripe webhook, NOT here (CLAUDE.md #2).
export default function CheckoutSuccessPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-cream">
        ✓
      </div>
      <h1 className="mt-5 text-2xl font-bold text-ink">
        Thank you — your order is confirmed!
      </h1>
      <p className="mt-3 text-muted">
        We’ve received your payment and your custom closet order. You’ll get an
        email confirmation shortly, and the team will begin production.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/configure"
          className="rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-ink hover:bg-card"
        >
          Design another
        </Link>
      </div>
    </main>
  );
}
