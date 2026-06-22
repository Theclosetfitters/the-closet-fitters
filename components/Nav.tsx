import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import SignOutButton from '@/components/SignOutButton';
import CartLink from '@/components/CartLink';
import Logo from '@/components/Logo';

// Tabler outline icons (22px) for the nav links — inline SVG, the same approach
// the rest of the app uses (no icon library added).
const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
const IconPhoto = () => (
  <svg {...iconProps}>
    <path d="M15 8h.01" />
    <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" />
    <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
    <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
  </svg>
);
const IconUser = () => (
  <svg {...iconProps}>
    <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
    <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
  </svg>
);
const IconUserCircle = () => (
  <svg {...iconProps}>
    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
    <path d="M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" />
  </svg>
);

// Sticky brand nav on a Cosmos (dark teal) background.
export default async function Nav() {
  const user = await getCurrentUser();
  let admin = false;
  if (user && isSupabaseConfigured()) {
    const supabase = await createClient();
    admin = await isAdmin(supabase, user.id);
  }

  const link = 'text-cream/80 transition hover:text-cream';
  const iconLink = 'text-cream/72 transition hover:text-cream';

  return (
    <header className="sticky top-0 z-20 bg-brand">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="The Closet Fitters home">
          <Logo tone="light" />
        </Link>
        <div className="flex items-center gap-4 text-sm sm:gap-5">
          <Link
            href="/gallery"
            title="Gallery"
            aria-label="Gallery"
            className={`hidden sm:inline ${iconLink}`}
          >
            <IconPhoto />
          </Link>
          <CartLink />
          {user && (
            <Link
              href="/account"
              title="My account"
              aria-label="My account"
              className={`hidden sm:inline ${iconLink}`}
            >
              <IconUserCircle />
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
            <Link
              href="/login"
              title="Sign In"
              aria-label="Sign In"
              className={`hidden sm:inline ${iconLink}`}
            >
              <IconUser />
            </Link>
          )}
          <Link
            href="/configure"
            className="rounded-full border border-cream/60 px-4 py-1.5 font-medium text-cream transition hover:bg-cream hover:text-brand"
          >
            Start Designing
          </Link>
          <Link
            href="/consultation"
            className="rounded-full border border-cream/45 bg-brand px-4 py-1.5 font-medium uppercase tracking-wide text-cream transition hover:border-cream"
          >
            Free Consultation
          </Link>
        </div>
      </nav>
    </header>
  );
}
