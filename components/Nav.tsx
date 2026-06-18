import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import SignOutButton from '@/components/SignOutButton';
import CartLink from '@/components/CartLink';
import Logo from '@/components/Logo';

// Sticky brand nav on a Cosmos (dark teal) background.
export default async function Nav() {
  const user = await getCurrentUser();
  let admin = false;
  if (user && isSupabaseConfigured()) {
    const supabase = await createClient();
    admin = await isAdmin(supabase, user.id);
  }

  const link = 'text-cream/80 transition hover:text-cream';

  return (
    <header className="sticky top-0 z-20 bg-brand">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="The Closet Fitters home">
          <Logo tone="light" />
        </Link>
        <div className="flex items-center gap-4 text-sm sm:gap-5">
          <Link href="/about" className={`hidden sm:inline ${link}`}>
            About
          </Link>
          <CartLink />
          {user && (
            <Link href="/account" className={`hidden sm:inline ${link}`}>
              My orders
            </Link>
          )}
          {admin && (
            <Link href="/admin" className={link}>
              Admin
            </Link>
          )}
          {user ? (
            <SignOutButton />
          ) : (
            <Link href="/login" className={`hidden sm:inline ${link}`}>
              Sign in
            </Link>
          )}
          <Link
            href="/configure"
            className="rounded-full border border-cream/60 px-4 py-1.5 font-medium text-cream transition hover:bg-cream hover:text-brand"
          >
            Start Designing
          </Link>
        </div>
      </nav>
    </header>
  );
}
