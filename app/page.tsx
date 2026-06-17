import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
        Custom closets, made to measure
      </span>
      <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
        Design your dream closet in minutes
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-600">
        Choose your type, set the dimensions, and pick materials and components.
        Watch it come to life in 3D with a live price — then order online.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/configure"
          className="rounded-full bg-amber-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          Start designing
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-zinc-300 px-8 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-white"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
