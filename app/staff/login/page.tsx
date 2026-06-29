'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#C7AC90',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
};
const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E5DDD5',
  borderRadius: 8,
  padding: '12px 14px',
  fontSize: 14,
  color: '#1F333A',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !data.user) {
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }
    // Only users with a staff_profiles row may enter the portal.
    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();
    if (!profile) {
      await supabase.auth.signOut();
      setError('Your account does not have staff access.');
      setLoading(false);
      return;
    }
    router.push('/staff/dashboard');
    router.refresh();
  }

  return (
    <div
      style={{
        background: '#F8F4F0',
        borderRadius: 12,
        // card sits on the layout's #F8F4F0 background
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          border: '0.5px solid #E5DDD5',
          padding: 40,
          width: 380,
          maxWidth: 'calc(100vw - 32px)',
          margin: '80px auto',
          boxSizing: 'border-box',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logos/monogram.svg"
          alt="The Closet Fitters"
          style={{ height: 48, display: 'block', margin: '0 auto' }}
        />
        <h1
          style={{
            fontFamily: 'var(--font-cormorant), Georgia, serif',
            fontSize: 28,
            color: '#1F333A',
            textAlign: 'center',
            marginTop: 16,
            marginBottom: 0,
            fontWeight: 500,
          }}
        >
          Staff Portal
        </h1>
        <p
          style={{
            fontSize: 13,
            color: '#7A6E65',
            textAlign: 'center',
            marginTop: 4,
            marginBottom: 32,
          }}
        >
          The Closet Fitters
        </p>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="staff-email" style={label}>
              Email
            </label>
            <input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = '#C7AC90')}
              onBlur={(e) => (e.target.style.borderColor = '#E5DDD5')}
              style={input}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="staff-password" style={label}>
              Password
            </label>
            <input
              id="staff-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = '#C7AC90')}
              onBlur={(e) => (e.target.style.borderColor = '#E5DDD5')}
              style={input}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#1F333A',
              color: '#EAE0D5',
              border: 'none',
              borderRadius: 9999,
              padding: 14,
              fontSize: 14,
              fontWeight: 500,
              marginTop: 8,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          {error && (
            <p style={{ fontSize: 13, color: '#C0392B', textAlign: 'center', marginTop: 12 }}>
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
