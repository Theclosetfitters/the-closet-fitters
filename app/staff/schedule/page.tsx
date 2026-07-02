import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { etWallToUtc, formatDateLabel, formatTimeET, todayET } from '@/lib/staff/scheduling';
import { getTravelTime } from '@/lib/travel-time';
import ScheduleDateNav from '@/components/staff/ScheduleDateNav';

export const dynamic = 'force-dynamic';

const CORMORANT = 'var(--font-cormorant), Georgia, serif';
const BUFFER_MIN = 15;

type ApptRow = {
  id: string;
  job_id: string | null;
  staff_id: string | null;
  client_address: string | null;
  scheduled_start: string;
  scheduled_end: string;
};

const TRAVEL_COLOR = { ok: '#2D7A2D', tight: '#A05C00', conflict: '#C0392B' } as const;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect('/staff/login');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/staff/login');
  const { data: me } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!me) redirect('/staff/login');

  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayET();

  const { data: apptsRaw } = await supabase
    .from('appointments')
    .select('id, job_id, staff_id, client_address, scheduled_start, scheduled_end, status')
    .gte('scheduled_start', etWallToUtc(date, 0).toISOString())
    .lt('scheduled_start', etWallToUtc(date, 24).toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_start', { ascending: true });
  const appts = (apptsRaw ?? []) as ApptRow[];

  // Resolve customer + staff names.
  const jobIds = [...new Set(appts.map((a) => a.job_id).filter(Boolean))] as string[];
  const { data: jobsRaw } = jobIds.length
    ? await supabase.from('jobs').select('id, customer_first_name, customer_last_name').in('id', jobIds)
    : { data: [] };
  const jobName = new Map<string, string>();
  for (const j of (jobsRaw ?? []) as {
    id: string;
    customer_first_name: string | null;
    customer_last_name: string | null;
  }[]) {
    jobName.set(j.id, `${j.customer_first_name ?? ''} ${j.customer_last_name ?? ''}`.trim() || 'Unknown');
  }
  const { data: staffRaw } = await supabase.from('staff_profiles').select('id, full_name');
  const staffName = new Map<string, string>();
  for (const s of (staffRaw ?? []) as { id: string; full_name: string }[]) staffName.set(s.id, s.full_name);

  // Travel time to the next appointment (color-coded).
  const items = await Promise.all(
    appts.map(async (a, i) => {
      const next = appts[i + 1];
      let travel: { mins: number; level: keyof typeof TRAVEL_COLOR } | null = null;
      if (next && a.client_address && next.client_address) {
        const t = await getTravelTime(a.client_address, next.client_address);
        if (t) {
          const gap = Math.round(
            (new Date(next.scheduled_start).getTime() - new Date(a.scheduled_end).getTime()) / 60000
          );
          const needed = t.durationMinutes + BUFFER_MIN;
          const level: keyof typeof TRAVEL_COLOR =
            gap >= needed ? 'ok' : gap >= t.durationMinutes ? 'tight' : 'conflict';
          travel = { mins: t.durationMinutes, level };
        }
      }
      return {
        id: a.id,
        jobId: a.job_id,
        start: formatTimeET(a.scheduled_start),
        name: a.job_id ? jobName.get(a.job_id) ?? 'Unknown' : 'Unknown',
        address: a.client_address ?? '',
        staff: a.staff_id ? staffName.get(a.staff_id) ?? '' : '',
        travel,
      };
    })
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <Link href="/staff/dashboard" style={{ fontSize: 13, color: '#C7AC90', textDecoration: 'none' }}>
        ← All Jobs
      </Link>
      <h1 style={{ fontFamily: CORMORANT, fontSize: 32, color: '#1F333A', margin: '12px 0 0', fontWeight: 500 }}>
        Daily Schedule
      </h1>
      <div style={{ fontSize: 14, color: '#7A6E65', marginTop: 2 }}>{formatDateLabel(date)}</div>
      <ScheduleDateNav date={date} />

      <div style={{ marginTop: 24 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontFamily: CORMORANT, fontSize: 20, color: '#7A6E65', margin: 0 }}>
              No appointments scheduled for this day
            </p>
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              style={{
                background: 'white',
                borderRadius: 12,
                border: '0.5px solid #E5DDD5',
                padding: '18px 20px',
                marginBottom: 10,
                display: 'flex',
                gap: 20,
                alignItems: 'flex-start',
              }}
            >
              {/* Time block */}
              <div style={{ minWidth: 90 }}>
                <div style={{ fontSize: 16, color: '#1F333A', fontWeight: 500 }}>{it.start}</div>
                <div style={{ fontSize: 12, color: '#7A6E65' }}>1 hour</div>
              </div>

              {/* Client info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, color: '#1F333A', fontWeight: 500 }}>{it.name}</div>
                {it.address && <div style={{ fontSize: 13, color: '#7A6E65', marginTop: 1 }}>{it.address}</div>}
                {it.staff && <div style={{ fontSize: 12, color: '#C7AC90', marginTop: 2 }}>{it.staff}</div>}
              </div>

              {/* Travel + link */}
              <div style={{ minWidth: 130, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                {it.travel && (
                  <div style={{ fontSize: 12, color: TRAVEL_COLOR[it.travel.level] }}>
                    ~{it.travel.mins} mins to next
                  </div>
                )}
                {it.jobId && (
                  <Link href={`/staff/jobs/${it.jobId}`} style={{ fontSize: 12, color: '#C7AC90', textDecoration: 'none' }}>
                    View Job →
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
