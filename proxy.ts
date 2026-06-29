// Next.js 16 "proxy" (formerly middleware.ts).
//  - staff.* subdomain -> rewrite into the /staff route group (staff portal).
//  - everything else    -> refresh the Supabase session cookie, as before.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const isStaffPortal =
    hostname.startsWith('staff.') || hostname === 'staff.theclosetfitters.com';

  if (isStaffPortal) {
    // Rewrite the staff subdomain to the /staff route group. Public routes are
    // never served on this host, so this branch can't affect the public site.
    const url = request.nextUrl.clone();
    if (!url.pathname.startsWith('/staff')) {
      url.pathname = '/staff' + url.pathname;
    }
    return NextResponse.rewrite(url);
  }

  // Public site — unchanged: keep the Supabase auth cookies fresh.
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on all paths except static assets, image optimization, and the
    // PWA service worker / manifest.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
