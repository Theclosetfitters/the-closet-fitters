// Reschedule (PATCH) or cancel (DELETE) an appointment (staff-only). Keeps the
// linked Google Calendar event in sync. Calendar failures are logged but never
// block the Supabase write.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  type CalendarAppointment,
} from '@/lib/google-calendar';

export const runtime = 'nodejs';

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

type JobRow = {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
};

async function requireStaff(supabase: ServerSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: me } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  return Boolean(me);
}

function toCalendarAppointment(job: JobRow, startISO: string, endISO: string): CalendarAppointment {
  return {
    jobId: job.id,
    name: `${job.customer_first_name ?? ''} ${job.customer_last_name ?? ''}`.trim() || 'Customer',
    phone: job.customer_phone ?? '',
    email: job.customer_email ?? '',
    address: job.customer_address ?? '',
    startISO,
    endISO,
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!(await requireStaff(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { staffId, startISO, endISO } = body ?? {};
  if (!startISO || !endISO) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, job_id, google_calendar_event_id')
    .eq('id', id)
    .maybeSingle();
  if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

  const update: Record<string, unknown> = {
    scheduled_start: startISO,
    scheduled_end: endISO,
  };
  if (staffId) update.staff_id = staffId;
  const { error } = await supabase.from('appointments').update(update).eq('id', id);
  if (error) {
    console.error('Appointment update failed:', error);
    return NextResponse.json({ error: 'Could not reschedule' }, { status: 500 });
  }

  // Keep the Calendar event in sync (best-effort).
  try {
    const { data: job } = await supabase
      .from('jobs')
      .select('id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_address')
      .eq('id', appt.job_id)
      .maybeSingle<JobRow>();
    if (job) {
      const calAppt = toCalendarAppointment(job, startISO, endISO);
      if (appt.google_calendar_event_id) {
        await updateCalendarEvent(appt.google_calendar_event_id as string, calAppt);
      } else {
        const eventId = await createCalendarEvent(calAppt);
        if (eventId) {
          await supabase
            .from('appointments')
            .update({ google_calendar_event_id: eventId })
            .eq('id', id);
        }
      }
    }
  } catch (err) {
    console.error('Calendar reschedule sync failed (appointment still updated):', err);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!(await requireStaff(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, job_id, google_calendar_event_id')
    .eq('id', id)
    .maybeSingle();
  if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

  // Delete the Calendar event (best-effort).
  if (appt.google_calendar_event_id) {
    try {
      await deleteCalendarEvent(appt.google_calendar_event_id as string);
    } catch (err) {
      console.error('Calendar delete failed (appointment still cancelled):', err);
    }
  }

  await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
  // Roll the job back to 'new' — only if it was still just 'scheduled'.
  if (appt.job_id) {
    await supabase.from('jobs').update({ status: 'new' }).eq('id', appt.job_id).eq('status', 'scheduled');
  }

  return NextResponse.json({ ok: true });
}
