import Link from 'next/link';
import Logo from '@/components/Logo';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <Logo size="lg" />
      <span className="mt-6 font-accent text-2xl text-walnut">
        craftsmanship, made to measure
      </span>
      <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Closets, fitted to your space
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-600">
        The Closet Fitters designs, engineers, and builds custom, made-to-measure
        closet systems. Plan yours bay by bay, watch it take shape in 3D with a
        live price, and request your quote.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/configure"
          className="rounded-full bg-brand px-8 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Start designing
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-sand px-8 py-3 text-sm font-semibold text-walnut transition hover:bg-cream-50"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
