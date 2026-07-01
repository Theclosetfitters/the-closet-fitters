// Google Calendar integration for staff consultation appointments.
// SERVER-ONLY — imports googleapis and reads GOOGLE_CLIENT_SECRET /
// GOOGLE_REFRESH_TOKEN. Never import this from a Client Component.
import { google } from 'googleapis';

export const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

export type CalendarAppointment = {
  jobId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  startISO: string;
  endISO: string;
};

/** OAuth2 client. Pass a redirectUri for the one-time consent flow; omit it for
 *  server-to-server calls that authenticate with the stored refresh token. */
export function getOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

export function isCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_CALENDAR_ID
  );
}

function getCalendar() {
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth });
}

function eventBody(appt: CalendarAppointment) {
  return {
    summary: `Closet Consultation — ${appt.name}`,
    location: appt.address || undefined,
    description:
      `Job ID: ${appt.jobId}\n` +
      `Customer: ${appt.name}\n` +
      `Phone: ${appt.phone}\n` +
      `Email: ${appt.email}\n` +
      `Address: ${appt.address}`,
    start: { dateTime: appt.startISO, timeZone: 'America/New_York' },
    end: { dateTime: appt.endISO, timeZone: 'America/New_York' },
  };
}

/** Creates a Calendar event; returns the event ID (or null if not configured). */
export async function createCalendarEvent(appt: CalendarAppointment): Promise<string | null> {
  if (!isCalendarConfigured()) return null;
  const calendar = getCalendar();
  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    requestBody: eventBody(appt),
  });
  return res.data.id ?? null;
}

/** Updates an existing event with new times/details (reschedule). */
export async function updateCalendarEvent(
  eventId: string,
  appt: CalendarAppointment
): Promise<void> {
  if (!isCalendarConfigured()) return;
  const calendar = getCalendar();
  await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    eventId,
    requestBody: eventBody(appt),
  });
}

/** Deletes an event (cancellation). */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (!isCalendarConfigured()) return;
  const calendar = getCalendar();
  await calendar.events.delete({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    eventId,
  });
}
