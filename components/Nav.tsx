import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import SignOutButton from '@/components/SignOutButton';
import CartLink from '@/components/CartLink';
import Logo from '@/components/Logo';

// Server component: reflects auth state in the nav.
export default async function Nav() {
  const user = await getCurrentUser();
  let admin = false;
  if (user && isSupabaseConfigured()) {
    const supabase = await createClient();
    admin = await isAdmin(supabase, user.id);
  }

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-card/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="The Closet Fitters home">
          <Logo />
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/configure" className="text-muted hover:text-ink">
            Configure
          </Link>
          <CartLink />
          {user && (
            <Link href="/account" className="text-muted hover:text-ink">
              My orders
            </Link>
          )}
          {admin && (
            <Link href="/admin" className="text-muted hover:text-ink">
              Admin
            </Link>
          )}
          {user ? (
            <SignOutButton />
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-ink px-4 py-1.5 font-medium text-cream hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
