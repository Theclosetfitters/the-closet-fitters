import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import SignOutButton from '@/components/SignOutButton';

// Server component: reflects auth state in the nav.
export default async function Nav() {
  const user = await getCurrentUser();
  let admin = false;
  if (user && isSupabaseConfigured()) {
    const supabase = await createClient();
    admin = await isAdmin(supabase, user.id);
  }

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-zinc-900">
          <span className="text-amber-600">▢</span> Custom Closets
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/configure" className="text-zinc-600 hover:text-zinc-900">
            Configure
          </Link>
          {user && (
            <Link href="/account" className="text-zinc-600 hover:text-zinc-900">
              My orders
            </Link>
          )}
          {admin && (
            <Link href="/admin" className="text-zinc-600 hover:text-zinc-900">
              Admin
            </Link>
          )}
          {user ? (
            <SignOutButton />
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-zinc-900 px-4 py-1.5 font-medium text-white hover:bg-zinc-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
