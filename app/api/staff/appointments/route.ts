// Create an appointment (staff-only). Inserts into Supabase, then best-effort
// creates a Google Calendar event and stores its id. A Calendar failure never
// blocks the booking.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCalendarEvent, type CalendarAppointment } from '@/lib/google-calendar';

export const runtime = 'nodejs';

type JobRow = {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { jobId, staffId, startISO, endISO } = body ?? {};
  if (!jobId || !staffId || !startISO || !endISO) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_address')
    .eq('id', jobId)
    .maybeSingle<JobRow>();
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const { data: appt, error } = await supabase
    .from('appointments')
    .insert({
      job_id: jobId,
      staff_id: staffId,
      scheduled_start: startISO,
      scheduled_end: endISO,
      client_address: job.customer_address ?? null,
      status: 'scheduled',
    })
    .select('id')
    .single();
  if (error || !appt) {
    console.error('Appointment insert failed:', error);
    return NextResponse.json({ error: 'Could not create appointment' }, { status: 500 });
  }

  // Best-effort Google Calendar event — never blocks the booking.
  try {
    const appointment: CalendarAppointment = {
      jobId: job.id,
      name: `${job.customer_first_name ?? ''} ${job.customer_last_name ?? ''}`.trim() || 'Customer',
      phone: job.customer_phone ?? '',
      email: job.customer_email ?? '',
      address: job.customer_address ?? '',
      startISO,
      endISO,
    };
    const eventId = await createCalendarEvent(appointment);
    if (eventId) {
      await supabase
        .from('appointments')
        .update({ google_calendar_event_id: eventId })
        .eq('id', appt.id);
    }
  } catch (err) {
    console.error('Calendar event create failed (appointment still saved):', err);
  }

  return NextResponse.json({ ok: true, id: appt.id });
}
