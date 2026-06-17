// Next.js 16 "proxy" (formerly middleware.ts). Refreshes the Supabase session
// cookie on each matched request.
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on all paths except static assets, image optimization, and the
    // PWA service worker / manifest.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
