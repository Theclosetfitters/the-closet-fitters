// Session-refresh logic for the App Router "proxy" (Next.js 16's renamed
// middleware). Keeps the Supabase auth cookies fresh on navigation.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function updateSession(
  request: NextRequest
): Promise<NextResponse> {
  // If Supabase isn't configured yet, do nothing — let the request through.
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: refreshes the session if expired. Do not run code between
  // createServerClient and getUser().
  await supabase.auth.getUser();

  return supabaseResponse;
}

/** Read the signed-in user from the request cookies (for proxy auth gating).
 * Returns null if Supabase isn't configured or there is no valid session. */
export async function getSessionUser(request: NextRequest) {
  if (!isSupabaseConfigured()) return null;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // read-only here
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
