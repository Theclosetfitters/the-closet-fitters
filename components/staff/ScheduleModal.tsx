'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  etWallToUtc,
  formatTimeET,
  hourLabel,
  isWeekend,
  slotHoursForDate,
  todayET,
} from '@/lib/staff/scheduling';

const CORMORANT = 'var(--font-cormorant), Georgia, serif';
const BUFFER_MIN = 15;

export type ScheduleJob = { id: string; name: string; address: string };

type DayAppt = { id: string; address: string; startISO: string; endISO: string };
type TravelSide = {
  travelMin: number;
  availableMin: number;
  neededMin: number;
  ok: boolean;
  time: string;
};
type TravelInfo = { prev: TravelSide | null; next: TravelSide | null };

async function fetchTravel(origin: string, destination: string) {
  try {
    const res = await fetch('/api/staff/travel-time', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { durationMinutes: number } | null;
  } catch {
    return null;
  }
}

export default function ScheduleModal({
  job,
  staff,
  existingId,
  onClose,
  onScheduled,
}: {
  job: ScheduleJob;
  staff: { id: string; name: string }[];
  existingId?: string;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [date, setDate] = useState('');
  const [hour, setHour] = useState<number | null>(null);
  const [staffId, setStaffId] = useState(staff[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [bookedHours, setBookedHours] = useState<Set<number>>(new Set());
  const [dayAppts, setDayAppts] = useState<DayAppt[]>([]);
  const [travel, setTravel] = useState<TravelInfo | null>(null);
  const [travelLoading, setTravelLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const weekend = date !== '' && isWeekend(date);
  const slots = date && !weekend ? slotHoursForDate(date) : [];
  const hasConflict = Boolean(
    travel && ((travel.prev && !travel.prev.ok) || (travel.next && !travel.next.ok))
  );

  // Keep a staff member selected once the list is available (guards against the
  // button being permanently disabled because staffId never got set).
  useEffect(() => {
    if (!staffId && staff.length > 0) setStaffId(staff[0].id);
  }, [staff, staffId]);

  // Grey out hours already taken by any staff member on the selected date, and
  // keep the day's appointments (with addresses) for the travel-time check.
  useEffect(() => {
    let cancelled = false;
    setHour(null);
    setTravel(null);
    if (!date || weekend) {
      setBookedHours(new Set());
      setDayAppts([]);
      return;
    }
    (async () => {
      const supabase = createClient();
      const dayStart = etWallToUtc(date, 0).toISOString();
      const dayEnd = etWallToUtc(date, 24).toISOString();
      let q = supabase
        .from('appointments')
        .select('id, client_address, scheduled_start, scheduled_end')
        .gte('scheduled_start', dayStart)
        .lt('scheduled_start', dayEnd)
        .neq('status', 'cancelled');
      if (existingId) q = q.neq('id', existingId);
      const { data } = await q;
      if (cancelled) return;
      const rows = (data ?? []) as {
        id: string;
        client_address: string | null;
        scheduled_start: string;
        scheduled_end: string;
      }[];
      const taken = new Set<number>();
      for (const row of rows) {
        const t = new Date(row.scheduled_start).getTime();
        for (const h of slotHoursForDate(date)) {
          if (etWallToUtc(date, h).getTime() === t) taken.add(h);
        }
      }
      setBookedHours(taken);
      setDayAppts(
        rows.map((r) => ({
          id: r.id,
          address: r.client_address ?? '',
          startISO: r.scheduled_start,
          endISO: r.scheduled_end,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [date, weekend, existingId]);

  // When a slot is picked, check driving time from the previous appointment and
  // to the next appointment. Warnings only — never blocks booking.
  useEffect(() => {
    let cancelled = false;
    if (hour === null || !date) {
      setTravel(null);
      return;
    }
    const slotStart = etWallToUtc(date, hour).getTime();
    const slotEnd = etWallToUtc(date, hour + 1).getTime();
    const newAddr = job.address;

    let prev: DayAppt | null = null;
    let next: DayAppt | null = null;
    for (const a of dayAppts) {
      const s = new Date(a.startISO).getTime();
      if (s < slotStart && (!prev || s > new Date(prev.startISO).getTime())) prev = a;
      if (s > slotStart && (!next || s < new Date(next.startISO).getTime())) next = a;
    }
    if (!prev && !next) {
      setTravel(null);
      return;
    }

    setTravelLoading(true);
    (async () => {
      const info: TravelInfo = { prev: null, next: null };
      if (prev && prev.address && newAddr) {
        const t = await fetchTravel(prev.address, newAddr);
        if (t) {
          const available = Math.round((slotStart - new Date(prev.endISO).getTime()) / 60000);
          const needed = t.durationMinutes + BUFFER_MIN;
          info.prev = {
            travelMin: t.durationMinutes,
            availableMin: available,
            neededMin: needed,
            ok: available >= needed,
            time: formatTimeET(prev.startISO),
          };
        }
      }
      if (next && next.address && newAddr) {
        const t = await fetchTravel(newAddr, next.address);
        if (t) {
          const available = Math.round((new Date(next.startISO).getTime() - slotEnd) / 60000);
          const needed = t.durationMinutes + BUFFER_MIN;
          info.next = {
            travelMin: t.durationMinutes,
            availableMin: available,
            neededMin: needed,
            ok: available >= needed,
            time: formatTimeET(next.startISO),
          };
        }
      }
      if (cancelled) return;
      setTravel(info.prev || info.next ? info : null);
      setTravelLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hour, date, dayAppts, job.address]);

  async function handleConfirm() {
    console.log('[ScheduleModal] Confirm clicked', { date, hour, staffId, saving });
    if (!date || hour === null || !staffId) {
      setError('Please pick a date, a time, and a staff member.');
      return;
    }
    setError(null);
    if (
      hasConflict &&
      !window.confirm('There may not be enough travel time between appointments. Book anyway?')
    ) {
      return;
    }
    setSaving(true);
    const start = etWallToUtc(date, hour);
    const end = etWallToUtc(date, hour + 1);
    // Writes go through a server route so the Google Calendar event can be
    // created/updated with server-only credentials.
    const payload = {
      jobId: job.id,
      staffId,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
    try {
      if (existingId) {
        await fetch(`/api/staff/appointments/${existingId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/staff/appointments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch (err) {
      console.error('Appointment save failed:', err);
    }
    setSaving(false);
    onScheduled();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31,51,58,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 70,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 28,
          width: 480,
          maxWidth: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <h2 style={{ fontFamily: CORMORANT, fontSize: 22, color: '#1F333A', margin: 0, fontWeight: 500 }}>
          Schedule Consultation
        </h2>
        <div style={{ fontSize: 13, color: '#7A6E65', marginTop: 4 }}>
          {job.name}
          {job.address ? ` · ${job.address}` : ''}
        </div>

        {/* Date */}
        <label style={labelStyle}>Date</label>
        <input
          type="date"
          value={date}
          min={todayET()}
          onChange={(e) => setDate(e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = '#C7AC90')}
          onBlur={(e) => (e.target.style.borderColor = '#E5DDD5')}
          style={inputStyle}
        />
        {weekend && (
          <div style={{ fontSize: 12, color: '#A05C00', marginTop: 6 }}>
            Appointments are Monday–Friday only.
          </div>
        )}

        {/* Time slots */}
        {date && !weekend && (
          <>
            <label style={labelStyle}>Time</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {slots.map((h) => {
                const booked = bookedHours.has(h);
                const active = hour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={booked}
                    onClick={() => setHour(h)}
                    style={{
                      padding: '10px 0',
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: booked ? 'not-allowed' : 'pointer',
                      border: active ? '1px solid #1F333A' : '1px solid #E5DDD5',
                      background: booked ? '#F0EBE4' : active ? '#1F333A' : 'white',
                      color: booked ? '#C7AC90' : active ? '#EAE0D5' : '#1F333A',
                      textDecoration: booked ? 'line-through' : 'none',
                    }}
                  >
                    {hourLabel(h)}
                  </button>
                );
              })}
            </div>

            {/* Travel-time check (warnings only) */}
            {travelLoading && (
              <div style={{ fontSize: 12, color: '#7A6E65', marginTop: 10 }}>
                Checking travel time…
              </div>
            )}
            {!travelLoading && travel && hasConflict && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {travel.prev && !travel.prev.ok && (
                  <div style={warnBox}>
                    ⚠️ Travel warning: {travel.prev.travelMin} mins from previous appointment at{' '}
                    {travel.prev.time}. Only {travel.prev.availableMin} mins available —{' '}
                    {travel.prev.neededMin} mins needed including buffer.
                  </div>
                )}
                {travel.next && !travel.next.ok && (
                  <div style={warnBox}>
                    ⚠️ Travel warning: {travel.next.travelMin} mins to next appointment at{' '}
                    {travel.next.time}. Only {travel.next.availableMin} mins available —{' '}
                    {travel.next.neededMin} mins needed including buffer.
                  </div>
                )}
              </div>
            )}
            {!travelLoading && travel && !hasConflict && (
              <div style={{ ...okBox, marginTop: 10 }}>
                ✓ Enough travel time from/to adjacent appointments
              </div>
            )}
          </>
        )}

        {/* Staff */}
        <label style={labelStyle}>Staff member</label>
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {staff.length === 0 && <option value="">No staff available</option>}
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {error && (
          <div style={{ fontSize: 13, color: '#C0392B', marginTop: 14 }}>{error}</div>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={handleConfirm}
          style={{
            width: '100%',
            marginTop: error ? 10 : 20,
            background: '#1F333A',
            color: '#EAE0D5',
            border: 'none',
            borderRadius: 9999,
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 500,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : !date || hour === null || !staffId ? 0.75 : 1,
          }}
        >
          {saving ? 'Scheduling…' : 'Confirm Appointment'}
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: '#C7AC90',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  margin: '18px 0 6px',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E5DDD5',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: '#1F333A',
  outline: 'none',
  boxSizing: 'border-box',
};
const warnBox: React.CSSProperties = {
  background: '#FFF4E5',
  border: '1px solid #F0A500',
  borderRadius: 8,
  padding: '12px 14px',
  fontSize: 13,
  color: '#A05C00',
};
const okBox: React.CSSProperties = {
  background: '#EAF4EA',
  border: '1px solid #2D7A2D',
  borderRadius: 8,
  padding: '12px 14px',
  fontSize: 13,
  color: '#2D7A2D',
};
