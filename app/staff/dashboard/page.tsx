import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import JobsDashboard, { type DashJob } from '@/components/staff/JobsDashboard';

// Per-request, server-rendered with the staff member's session (no flash).
export const dynamic = 'force-dynamic';

type JobRow = {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_address: string | null;
  status: string | null;
  created_at: string | null;
};
type StageRow = { job_id: string; completed: boolean | null };

export default async function StaffDashboardPage() {
  if (!isSupabaseConfigured()) redirect('/staff/login');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/staff/login');

  // Authorization: must have a staff_profiles row.
  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) redirect('/staff/login');

  const { data: jobsRaw } = await supabase
    .from('jobs')
    .select('id, customer_first_name, customer_last_name, customer_address, status, created_at')
    .order('created_at', { ascending: false });
  const { data: stagesRaw } = await supabase.from('job_stages').select('job_id, completed');

  const completedByJob = new Map<string, number>();
  for (const s of (stagesRaw ?? []) as StageRow[]) {
    if (s.completed) completedByJob.set(s.job_id, (completedByJob.get(s.job_id) ?? 0) + 1);
  }

  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const jobs: DashJob[] = ((jobsRaw ?? []) as JobRow[]).map((j) => ({
    id: j.id,
    name: `${j.customer_first_name ?? ''} ${j.customer_last_name ?? ''}`.trim() || 'Unknown',
    address: j.customer_address ?? '',
    status: j.status ?? 'new',
    createdLabel: j.created_at ? fmt.format(new Date(j.created_at)) : '',
    completedStages: completedByJob.get(j.id) ?? 0,
  }));
  const today = fmt.format(new Date());

  return <JobsDashboard jobs={jobs} today={today} />;
}
