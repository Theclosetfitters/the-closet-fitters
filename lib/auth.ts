// Server-side auth helpers. Admin checks ALWAYS run on the server (CLAUDE.md #3).
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

/** Returns true if the given user has the admin role in the profiles table. */
export async function isAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
  if (error) return false;
  return Boolean(data?.is_admin);
}

/** Get the current user, or null. Safe to call when Supabase is not configured. */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Require a signed-in user, else redirect to /login. Returns the user. */
export async function requireUser(redirectTo = '/login'): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

/**
 * Require an admin user. Redirects non-admins. Use at the top of every /admin
 * server component / action — never rely on hidden UI.
 */
export async function requireAdmin(): Promise<User> {
  if (!isSupabaseConfigured()) redirect('/login');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!(await isAdmin(supabase, user.id))) redirect('/');
  return user;
}
