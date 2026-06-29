// Next.js 16 "proxy" (formerly middleware.ts).
//  - staff.* subdomain  -> rewrite into the /staff route group (staff portal).
//  - any /staff route    -> require a Supabase session (except /staff/login),
//                           and tag the request so the root layout hides the
//                           public nav.
//  - everything else     -> refresh the Supabase session cookie, as before.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionUser, updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const isSubdomain =
    hostname.startsWith('staff.') || hostname === 'staff.theclosetfitters.com';
  const path = request.nextUrl.pathname;

  // The portal is reached two ways: the staff.* subdomain (any path) or, for
  // local dev, a direct /staff/* path.
  const onStaff = isSubdomain || path.startsWith('/staff');
  if (!onStaff) {
    // Public site — unchanged behavior.
    return await updateSession(request);
  }

  // The path as it will be served under the /staff route group.
  const staffPath = path.startsWith('/staff') ? path : '/staff' + path;

  // Protect everything except the login page.
  if (!staffPath.startsWith('/staff/login')) {
    const user = await getSessionUser(request);
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      // On the subdomain the public "/login" rewrites to /staff/login below.
      loginUrl.pathname = isSubdomain ? '/login' : '/staff/login';
      return NextResponse.redirect(loginUrl);
    }
  }

  // Tag the request so the (shared) root layout can drop the public nav.
  const headers = new Headers(request.headers);
  headers.set('x-staff-portal', '1');

  if (isSubdomain && !path.startsWith('/staff')) {
    const url = request.nextUrl.clone();
    url.pathname = staffPath;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    // Run on all paths except static assets, image optimization, and the
    // PWA service worker / manifest.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
