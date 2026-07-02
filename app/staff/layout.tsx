import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import StaffSignOut from '@/components/staff/StaffSignOut';

export const metadata: Metadata = {
  title: 'Staff Portal · The Closet Fitters',
};

// Staff portal shell — no public nav/footer (the root layout drops the public
// nav for /staff via the proxy's x-staff-portal header). Cosmos top bar with
// the monogram; the employee name + Sign Out show only when signed in.
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let name: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('staff_profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      name = profile?.full_name ?? user.email ?? null;
    }
  }

  return (
    <div style={{ background: '#F8F4F0', minHeight: '100vh' }}>
      <header
        style={{
          background: '#1F333A',
          height: 56,
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logos/monogram.svg"
          alt="The Closet Fitters"
          style={{ height: 36, filter: 'brightness(0) invert(1)' }}
        />
        {name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/staff/schedule" style={{ color: '#C7AC90', fontSize: 13, textDecoration: 'none' }}>
              Today&rsquo;s Schedule
            </a>
            <span style={{ color: '#7A6E65', fontSize: 13 }}>|</span>
            <span style={{ color: '#EAE0D5', fontSize: 13 }}>{name}</span>
            <span style={{ color: '#7A6E65', fontSize: 13 }}>|</span>
            <StaffSignOut />
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
