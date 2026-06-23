'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Sign-in only. There are no customer accounts on this site; this form is the
// sign-in used to reach the admin dashboard (protected server-side by
// requireAdmin). Account creation is handled out-of-band in Supabase.
export default function AuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-brand py-2.5 text-sm font-semibold text-cream hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Please wait…' : 'Sign in'}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" /> or{' '}
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        className="w-full rounded-full border border-line py-2.5 text-sm font-medium text-ink hover:bg-cream-50"
      >
        Continue with Google
      </button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
