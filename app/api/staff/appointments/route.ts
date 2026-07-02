// Create an appointment (staff-only). Auth is checked with the cookie client,
// but the writes use the SERVICE ROLE client so the insert can't be silently
// rejected by RLS. A Calendar failure never blocks the booking.
import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createCalendarEvent, type CalendarAppointment } from '@/lib/google-calendar';
import { isEmailConfigured, sendQuoteEmail } from '@/lib/email';
import { buildAppointmentConfirmationHtml } from '@/lib/appointment-email';
import { ET, formatTimeET } from '@/lib/staff/scheduling';

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
  // Authenticate + authorize with the user's session (cookie client).
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

  const body = await request.json().catch(() => null);
  const { jobId, staffId, startISO, endISO } = body ?? {};
  if (!jobId || !staffId || !startISO || !endISO) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Trusted writes bypass RLS via the service role client.
  const db = createServiceRoleClient();

  const { data: job } = await db
    .from('jobs')
    .select('id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_address')
    .eq('id', jobId)
    .maybeSingle<JobRow>();
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const { data: appt, error } = await db
    .from('appointments')
    .insert({
      job_id: jobId,
      staff_id: staffId,
      scheduled_start: startISO,
      scheduled_end: endISO,
      client_address: job.customer_address ?? null,
      status: 'scheduled',
    })
    .select()
    .single();
  if (error || !appt) {
    console.error('Appointment insert error:', error);
    return NextResponse.json(
      { error: 'Could not create appointment', details: error },
      { status: 500 }
    );
  }

  // Move the job to 'scheduled' (only if still 'new').
  await db.from('jobs').update({ status: 'scheduled' }).eq('id', jobId).eq('status', 'new');

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
      await db.from('appointments').update({ google_calendar_event_id: eventId }).eq('id', appt.id);
    }
  } catch (err) {
    console.error('Calendar event create failed (appointment still saved):', err);
  }

  // Confirmation email to the client — best-effort, never blocks the booking.
  try {
    if (!job.customer_email) {
      console.warn('Appointment confirmation email skipped: job has no customer_email', jobId);
    } else if (isEmailConfigured()) {
      const { data: staffProfile } = await db
        .from('staff_profiles')
        .select('full_name')
        .eq('id', staffId)
        .maybeSingle();
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ??
        request.headers.get('origin') ??
        new URL(request.url).origin;
      const dateLabel = new Intl.DateTimeFormat('en-US', {
        timeZone: ET,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(startISO));
      const timeLabel = `${formatTimeET(startISO)} — ${formatTimeET(endISO)} Eastern Time`;
      await sendQuoteEmail({
        to: job.customer_email,
        subject: 'The Closet Fitters — Your Consultation is Confirmed',
        html: buildAppointmentConfirmationHtml({
          firstName: job.customer_first_name ?? 'there',
          dateLabel,
          timeLabel,
          address: job.customer_address ?? '',
          consultant: (staffProfile?.full_name as string) ?? 'your consultant',
          baseUrl,
        }),
      });
    }
  } catch (err) {
    console.error('Appointment confirmation email failed (appointment still saved):', err);
  }

  return NextResponse.json({ ok: true, id: appt.id });
}
