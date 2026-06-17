// Server-side Supabase client (for Server Components, Route Handlers, Server Actions).
// Reads/writes auth cookies so sessions persist across requests.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Safe to ignore when middleware refreshes the session.
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses Row Level Security. SERVER ONLY.
 * Never import this into a Client Component. Use for trusted operations
 * like writing orders after a verified Stripe webhook.
 */
export function createServiceRoleClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: service role client is stateless
        },
      },
    }
  );
}
