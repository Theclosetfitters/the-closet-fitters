import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { catalog } from '@/lib/catalog';
import { computePrice } from '@/lib/pricing';
import { finishedHeightLabel, normalizeConfig, wallsForShape } from '@/lib/config';
import { formatCents } from '@/lib/format';
import type { ClosetConfig } from '@/types';
import JobDetail, {
  type ClosetSummary,
  type JobAppointment,
  type JobInfo,
  type StageRow,
} from '@/components/staff/JobDetail';

export const dynamic = 'force-dynamic';

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function closetSummary(raw: unknown): ClosetSummary | null {
  // closet_config is the cart payload: [{ config }]. Be tolerant of shapes.
  const cfg = (raw as { config?: ClosetConfig })?.config ?? (raw as ClosetConfig);
  if (!cfg || typeof cfg !== 'object' || !('sections' in cfg)) return null;
  const config = normalizeConfig(catalog, cfg);
  const label = (arr: { id: string; label: string }[], id: string) =>
    arr.find((x) => x.id === id)?.label ?? id;
  return {
    shape: label(catalog.shapes, config.shape),
    walls: wallsForShape(config.shape).length,
    bays: config.sections.length,
    material: label(catalog.materials, config.materialId),
    hardwareStyle: label(catalog.hardwareStyles, config.hardwareStyleId),
    hardwareColor: label(catalog.hardware, config.hardwareColorId),
    rodColor: label(catalog.hardware, config.rodColorId),
    height: finishedHeightLabel(catalog, config),
    priceCents: computePrice(catalog, config).totalCents,
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) redirect('/staff/login');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/staff/login');

  const { data: me } = await supabase
    .from('staff_profiles')
    .select('id, full_name')
    .eq('id', user.id)
    .maybeSingle();
  if (!me) redirect('/staff/login');

  const { data: job } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (!job) notFound();

  const { data: stagesRaw } = await supabase
    .from('job_stages')
    .select('id, stage, completed, completed_at, completed_by')
    .eq('job_id', id);
  const { data: photosRaw } = await supabase
    .from('job_photos')
    .select('id, stage, photo_url')
    .eq('job_id', id);
  const { data: staff } = await supabase.from('staff_profiles').select('id, full_name');
  const { data: apptRaw } = await supabase
    .from('appointments')
    .select('id, staff_id, scheduled_start, scheduled_end, status')
    .eq('job_id', id)
    .neq('status', 'cancelled')
    .order('scheduled_start', { ascending: true })
    .limit(1)
    .maybeSingle();

  const staffNames: Record<string, string> = {};
  const staffList: { id: string; name: string }[] = [];
  for (const s of (staff ?? []) as { id: string; full_name: string }[]) {
    staffNames[s.id] = s.full_name;
    staffList.push({ id: s.id, name: s.full_name });
  }

  const appointment: JobAppointment | null = apptRaw
    ? {
        id: apptRaw.id as string,
        startISO: apptRaw.scheduled_start as string,
        staffName: apptRaw.staff_id ? staffNames[apptRaw.staff_id as string] ?? '' : '',
      }
    : null;

  const stages: StageRow[] = ((stagesRaw ?? []) as StageRow[]).map((s) => ({
    id: s.id,
    stage: s.stage,
    completed: Boolean(s.completed),
    completed_at: s.completed_at ?? null,
    completed_by: s.completed_by ?? null,
  }));

  const photos = ((photosRaw ?? []) as { id: string; stage: string | null; photo_url: string }[]).map(
    (p) => ({ id: p.id, stage: p.stage ?? '', path: p.photo_url })
  );

  const rawClosets: unknown[] = Array.isArray(job.closet_config) ? job.closet_config : [];
  const closets: ClosetSummary[] = rawClosets
    .map(closetSummary)
    .filter((c): c is ClosetSummary => c !== null);
  const grandTotalCents = closets.reduce((a, c) => a + c.priceCents, 0);

  const info: JobInfo = {
    id: job.id,
    name: `${job.customer_first_name ?? ''} ${job.customer_last_name ?? ''}`.trim() || 'Unknown',
    address: job.customer_address ?? '',
    email: job.customer_email ?? '',
    phone: job.customer_phone ?? '',
    howHeard: job.how_heard ?? '',
    createdLabel: job.created_at ? fmt.format(new Date(job.created_at)) : '',
    notes: job.notes ?? '',
  };

  return (
    <JobDetail
      info={info}
      stages={stages}
      photos={photos}
      closets={closets}
      grandTotal={formatCents(grandTotalCents)}
      staffNames={staffNames}
      currentUser={{ id: me.id, name: me.full_name }}
      appointment={appointment}
      staff={staffList}
    />
  );
}
