// Eastern-Time scheduling helpers for the staff portal booking UI.
// All business hours and display are in America/New_York; the DB stores UTC
// (TIMESTAMPTZ). These convert between an ET wall-clock time and a UTC instant
// (DST-aware) without a date library.

export const ET = 'America/New_York';

// Minutes ET is *behind* UTC at the given instant (300 = EST, 240 = EDT).
function etOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    timeZoneName: 'longOffset',
  }).formatToParts(at);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-05:00';
  const m = tz.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 300;
  const sign = m[1] === '-' ? 1 : -1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

// UTC Date for an ET wall-clock time (hour/minute) on the given YYYY-MM-DD.
export function etWallToUtc(dateStr: string, hour: number, minute = 0): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, hour, minute, 0);
  const off = etOffsetMinutes(new Date(guess));
  return new Date(guess + off * 60000);
}

// 0 = Sun .. 6 = Sat, for a plain calendar date (noon avoids TZ edges).
export function dayOfWeek(dateStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d, 12).getDay();
}

// Slot start hours (ET) for a date. Mon–Thu 9–17 (last ends 6pm),
// Fri 9–13 (last ends 2pm), empty on weekends.
export function slotHoursForDate(dateStr: string): number[] {
  const dow = dayOfWeek(dateStr);
  if (dow >= 1 && dow <= 4) return [9, 10, 11, 12, 13, 14, 15, 16, 17];
  if (dow === 5) return [9, 10, 11, 12, 13];
  return [];
}

export function isWeekend(dateStr: string): boolean {
  const dow = dayOfWeek(dateStr);
  return dow === 0 || dow === 6;
}

// "9:00 AM" from a 24h hour.
export function hourLabel(hour: number): string {
  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h12}:00 ${ampm}`;
}

export function formatDateET(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

export function formatTimeET(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

// Today's date in ET as YYYY-MM-DD (for the date-input min).
export function todayET(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// The ET calendar date (YYYY-MM-DD) that a UTC instant falls on.
export function etDateString(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

// Shift a YYYY-MM-DD date string by n days (calendar math, TZ-agnostic).
export function addDays(dateStr: string, n: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// "Mon, Jul 6" for a plain YYYY-MM-DD (no TZ shift).
export function formatDateLabel(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, mo - 1, d, 12)));
}
