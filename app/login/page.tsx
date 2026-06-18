import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16">
      <h1 className="mb-2 text-2xl font-bold text-ink">Welcome back</h1>
      <p className="mb-8 text-sm text-muted">
        Sign in to track your orders — or{' '}
        <Link href="/configure" className="text-walnut underline">
          check out as a guest
        </Link>
        .
      </p>

      {configured ? (
        <AuthForm />
      ) : (
        <div className="w-full max-w-sm rounded-lg border border-sand bg-cream-50 p-4 text-sm text-walnut">
          Authentication isn’t configured yet. Add your Supabase keys to
          <code className="mx-1 rounded bg-cream px-1">.env.local</code>
          to enable sign in.
        </div>
      )}
    </main>
  );
}
