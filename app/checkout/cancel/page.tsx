import Link from 'next/link';

export const metadata = { title: 'Checkout canceled' };

export default function CheckoutCancelPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-2xl font-bold text-zinc-900">Checkout canceled</h1>
      <p className="mt-3 text-zinc-600">
        No payment was taken. Your design is still here whenever you’re ready.
      </p>
      <Link
        href="/configure"
        className="mt-8 rounded-full bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
      >
        Back to the configurator
      </Link>
    </main>
  );
}
