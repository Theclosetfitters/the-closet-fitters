'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function StaffSignOut() {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/staff/login');
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={signOut}
      style={{ background: 'none', border: 'none', color: '#C7AC90', fontSize: 13, cursor: 'pointer', padding: 0 }}
    >
      Sign Out
    </button>
  );
}
