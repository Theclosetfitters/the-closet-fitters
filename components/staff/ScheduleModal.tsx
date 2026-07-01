'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  etWallToUtc,
  hourLabel,
  isWeekend,
  slotHoursForDate,
  todayET,
} from '@/lib/staff/scheduling';

const CORMORANT = 'var(--font-cormorant), Georgia, serif';

export type ScheduleJob = { id: string; name: string; address: string };

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
  const [bookedHours, setBookedHours] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const weekend = date !== '' && isWeekend(date);
  const slots = date && !weekend ? slotHoursForDate(date) : [];

  // Grey out hours already taken by any staff member on the selected date.
  useEffect(() => {
    let cancelled = false;
    setHour(null);
    if (!date || weekend) {
      setBookedHours(new Set());
      return;
    }
    (async () => {
      const supabase = createClient();
      const dayStart = etWallToUtc(date, 0).toISOString();
      const dayEnd = etWallToUtc(date, 24).toISOString();
      let q = supabase
        .from('appointments')
        .select('id, scheduled_start')
        .gte('scheduled_start', dayStart)
        .lt('scheduled_start', dayEnd)
        .neq('status', 'cancelled');
      if (existingId) q = q.neq('id', existingId);
      const { data } = await q;
      if (cancelled) return;
      const taken = new Set<number>();
      for (const row of (data ?? []) as { scheduled_start: string }[]) {
        const t = new Date(row.scheduled_start).getTime();
        for (const h of slotHoursForDate(date)) {
          if (etWallToUtc(date, h).getTime() === t) taken.add(h);
        }
      }
      setBookedHours(taken);
    })();
    return () => {
      cancelled = true;
    };
  }, [date, weekend, existingId]);

  async function confirm() {
    if (!date || hour === null || !staffId) return;
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

        <button
          type="button"
          disabled={!date || hour === null || !staffId || saving}
          onClick={confirm}
          style={{
            width: '100%',
            marginTop: 20,
            background: '#1F333A',
            color: '#EAE0D5',
            border: 'none',
            borderRadius: 9999,
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 500,
            cursor: !date || hour === null || !staffId || saving ? 'default' : 'pointer',
            opacity: !date || hour === null || !staffId || saving ? 0.6 : 1,
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
