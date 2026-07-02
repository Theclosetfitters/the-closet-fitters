// Delete a job and all its related rows (staff-only). Auth is checked with the
// cookie client; the deletes use the service-role client. Child rows are removed
// explicitly (in case FKs don't cascade) and everything is scoped to this job id.
import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await auth
    .from('staff_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = createServiceRoleClient();
  // Remove children first (scoped to this job only), then the job itself.
  await db.from('appointments').delete().eq('job_id', id);
  await db.from('job_photos').delete().eq('job_id', id);
  await db.from('job_stages').delete().eq('job_id', id);
  const { error } = await db.from('jobs').delete().eq('id', id);
  if (error) {
    console.error('Job delete error:', error);
    return NextResponse.json({ error: 'Could not delete job', details: error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
