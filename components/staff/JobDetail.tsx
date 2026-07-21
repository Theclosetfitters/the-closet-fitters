'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ScheduleModal from '@/components/staff/ScheduleModal';
import { formatDateET, formatTimeET } from '@/lib/staff/scheduling';

export type ClosetSummary = {
  name?: string;
  shape: string;
  walls: number;
  bays: number;
  material: string;
  hardwareStyle: string;
  hardwareColor: string;
  rodColor: string;
  height: string;
  priceCents: number;
  roomWidthDisplay?: string;
  roomDepthDisplay?: string;
  roomHeightDisplay?: string;
};
export type JobInfo = {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  howHeard: string;
  createdLabel: string;
  notes: string;
};
export type StageRow = {
  id: string;
  stage: string;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
};
export type JobAppointment = { id: string; startISO: string; staffName: string };
type Photo = { id: string; path: string; url: string };

const STAGES = [
  { key: 'deposit_received', label: 'Signed Invoice & Deposit Received' },
  { key: 'cut_edge_banded', label: 'Cut & Edge Banded' },
  { key: 'assembled', label: 'Assembled' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'installed', label: 'Installed' },
];
const STAGE_KEYS = new Set(STAGES.map((s) => s.key));
const STATUS_FOR: Record<string, string> = {
  deposit_received: 'in_production',
  cut_edge_banded: 'in_production',
  assembled: 'assembled',
  delivered: 'delivered',
  installed: 'complete',
};
function statusFromCompleted(done: Set<string>): string {
  let latest = -1;
  STAGES.forEach((s, i) => {
    if (done.has(s.key)) latest = i;
  });
  return latest === -1 ? 'new' : STATUS_FOR[STAGES[latest].key];
}

const CORMORANT = 'var(--font-cormorant), Georgia, serif';
const card: React.CSSProperties = {
  background: 'white',
  borderRadius: 12,
  border: '0.5px solid #E5DDD5',
  padding: 24,
};
const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#C7AC90',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};
const fieldLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#C7AC90',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function JobDetail({
  info,
  stages: initialStages,
  photos: initialPhotos,
  closets,
  grandTotal,
  staffNames,
  currentUser,
  appointment,
  staff,
  travelFromPrev,
  travelToNext,
}: {
  info: JobInfo;
  stages: StageRow[];
  photos: { id: string; stage: string; path: string }[];
  closets: ClosetSummary[];
  grandTotal: string;
  staffNames: Record<string, string>;
  currentUser: { id: string; name: string };
  appointment: JobAppointment | null;
  staff: { id: string; name: string }[];
  travelFromPrev: number | null;
  travelToNext: number | null;
}) {
  const router = useRouter();
  const [stages, setStages] = useState<StageRow[]>(initialStages);
  const [photosByStage, setPhotosByStage] = useState<Record<string, Photo[]>>({});
  const [notes, setNotes] = useState(info.notes);
  const savedNotes = useRef(info.notes);
  const [toast, setToast] = useState<string | null>(null);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // Sign the private bucket photos for display.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (initialPhotos.length === 0) return;
      const supabase = createClient();
      const byStage: Record<string, Photo[]> = {};
      for (const p of initialPhotos) {
        const { data } = await supabase.storage.from('job-photos').createSignedUrl(p.path, 3600);
        (byStage[p.stage] ??= []).push({ id: p.id, path: p.path, url: data?.signedUrl ?? '' });
      }
      if (!cancelled) setPhotosByStage(byStage);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPhotos]);

  const completedCount = stages.filter((s) => s.completed && STAGE_KEYS.has(s.stage)).length;
  const isDone = (key: string) => stages.find((s) => s.stage === key)?.completed ?? false;

  async function toggleStage(key: string) {
    const current = stages.find((s) => s.stage === key);
    if (!current) return;
    const completing = !current.completed;

    if (completing) {
      const idx = STAGES.findIndex((s) => s.key === key);
      if (idx > 0 && !isDone(STAGES[idx - 1].key)) {
        showToast('Complete the previous stage first');
      }
    }

    const stamp = new Date().toISOString();
    const updated = stages.map((s) =>
      s.stage === key
        ? {
            ...s,
            completed: completing,
            completed_at: completing ? stamp : null,
            completed_by: completing ? currentUser.id : null,
          }
        : s
    );
    setStages(updated);
    const done = new Set(updated.filter((s) => s.completed).map((s) => s.stage));
    const status = statusFromCompleted(done);

    const supabase = createClient();
    await supabase
      .from('job_stages')
      .update({
        completed: completing,
        completed_at: completing ? stamp : null,
        completed_by: completing ? currentUser.id : null,
      })
      .eq('job_id', info.id)
      .eq('stage', key);
    await supabase.from('jobs').update({ status }).eq('id', info.id);

    if (completing) {
      if (key === 'installed') {
        showToast('Job complete! ✓');
        setTimeout(() => router.push('/staff/dashboard'), 2000);
      } else {
        const idx = STAGES.findIndex((s) => s.key === key);
        if (idx === 0 || isDone(STAGES[idx - 1].key)) showToast('Stage marked complete ✓');
      }
    } else {
      showToast('Stage unchecked');
    }
  }

  async function uploadPhoto(stageKey: string, file: File) {
    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${info.id}/${stageKey}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage.from('job-photos').upload(path, file);
    if (upErr) {
      showToast('Photo upload failed');
      return;
    }
    const { data: row } = await supabase
      .from('job_photos')
      .insert({ job_id: info.id, stage: stageKey, photo_url: path, uploaded_by: currentUser.id })
      .select('id')
      .single();
    const { data: signed } = await supabase.storage.from('job-photos').createSignedUrl(path, 3600);
    setPhotosByStage((prev) => ({
      ...prev,
      [stageKey]: [
        ...(prev[stageKey] ?? []),
        { id: (row?.id as string) ?? path, path, url: signed?.signedUrl ?? '' },
      ],
    }));
    showToast('Photo uploaded ✓');
  }

  async function saveNotes() {
    if (notes === savedNotes.current) return;
    const supabase = createClient();
    await supabase.from('jobs').update({ notes }).eq('id', info.id);
    savedNotes.current = notes;
    showToast('Notes saved');
  }

  async function cancelAppointment() {
    if (!appointment) return;
    if (!window.confirm('Cancel this appointment?')) return;
    try {
      await fetch(`/api/staff/appointments/${appointment.id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Cancel failed:', err);
    }
    showToast('Appointment cancelled');
    router.refresh();
  }

  // Stage changes auto-save on checkbox click, so this only confirms + returns.
  function updateAndReturn() {
    showToast('Job updated ✓');
    setTimeout(() => router.push('/staff/dashboard'), 1000);
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <Link href="/staff/dashboard" style={{ fontSize: 13, color: '#C7AC90', textDecoration: 'none' }}>
        ← All Jobs
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr]" style={{ gap: 16, alignItems: 'start', marginTop: 16 }}>
        {/* LEFT — appointment + stage tracker */}
        <div>
          {/* Appointment card */}
          <div style={{ ...card, padding: 20, marginBottom: 16 }}>
            {appointment ? (
              <>
                <div style={sectionLabel}>Consultation Scheduled</div>
                <div style={{ fontFamily: CORMORANT, fontSize: 20, color: '#1F333A', marginTop: 4 }}>
                  {formatDateET(appointment.startISO)} at {formatTimeET(appointment.startISO)}
                </div>
                {appointment.staffName && (
                  <div style={{ fontSize: 13, color: '#7A6E65', marginTop: 2 }}>
                    With {appointment.staffName}
                  </div>
                )}
                {(travelFromPrev !== null || travelToNext !== null) && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {travelFromPrev !== null && (
                      <div style={{ fontSize: 12, color: '#7A6E65' }}>
                        ~{travelFromPrev} mins from previous appointment
                      </div>
                    )}
                    {travelToNext !== null && (
                      <div style={{ fontSize: 12, color: '#7A6E65' }}>
                        ~{travelToNext} mins to next appointment
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setScheduleOpen(true)}
                    style={{ background: 'none', border: 'none', color: '#C7AC90', fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={cancelAppointment}
                    style={{ background: 'none', border: 'none', color: '#C0392B', fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    Cancel Appointment
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13, color: '#7A6E65' }}>No consultation scheduled yet</span>
                <button
                  type="button"
                  onClick={() => setScheduleOpen(true)}
                  style={{
                    background: '#1F333A',
                    color: '#EAE0D5',
                    border: 'none',
                    borderRadius: 9999,
                    padding: '6px 16px',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Schedule Now
                </button>
              </div>
            )}
          </div>

          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ ...sectionLabel, marginBottom: 20 }}>Job Progress</div>

            <div style={{ fontSize: 13, color: '#7A6E65', marginBottom: 8 }}>
              {completedCount} of {STAGES.length} stages complete
            </div>
            <div style={{ background: '#F0EBE4', height: 6, borderRadius: 9999, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ background: '#C7AC90', height: 6, borderRadius: 9999, width: `${Math.round((completedCount / STAGES.length) * 100)}%` }} />
            </div>

            {STAGES.map((st, i) => {
              const row = stages.find((s) => s.stage === st.key);
              const done = row?.completed ?? false;
              const photos = photosByStage[st.key] ?? [];
              return (
                <div
                  key={st.key}
                  style={{
                    padding: '16px 0',
                    borderBottom: i < STAGES.length - 1 ? '0.5px solid #F0EBE4' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <button
                      type="button"
                      aria-label={done ? `Uncheck ${st.label}` : `Complete ${st.label}`}
                      onClick={() => toggleStage(st.key)}
                      style={{
                        flexShrink: 0,
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: done ? '2px solid #1F333A' : '2px solid #E5DDD5',
                        background: done ? '#1F333A' : 'white',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 1,
                      }}
                    >
                      {done && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EAE0D5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5l10 -10" />
                        </svg>
                      )}
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 500,
                          color: done ? '#7A6E65' : '#1F333A',
                          textDecoration: done ? 'line-through' : 'none',
                        }}
                      >
                        {st.label}
                      </div>
                      {done && row?.completed_at && (
                        <div style={{ fontSize: 12, color: '#C7AC90', marginTop: 2 }}>
                          Completed by {row.completed_by ? staffNames[row.completed_by] ?? 'staff' : 'staff'} on{' '}
                          {dateFmt.format(new Date(row.completed_at))}
                        </div>
                      )}
                    </div>

                    {done && (
                      <label
                        style={{ fontSize: 12, color: '#C7AC90', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        + Add Photo
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadPhoto(st.key, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {photos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, marginLeft: 36 }}>
                      {photos.map((ph) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={ph.id}
                          src={ph.url}
                          alt="Job photo"
                          onClick={() => setModalUrl(ph.url)}
                          style={{
                            width: 64,
                            height: 64,
                            objectFit: 'cover',
                            borderRadius: 6,
                            border: '0.5px solid #E5DDD5',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={updateAndReturn}
              style={{
                width: '100%',
                marginTop: 20,
                background: '#1F333A',
                color: '#EAE0D5',
                border: 'none',
                borderRadius: 9999,
                padding: 14,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Update
            </button>
          </div>
        </div>

        {/* RIGHT — client info + closet config (sticky) */}
        <div style={{ ...card, position: 'sticky', top: 24 }}>
          <div style={sectionLabel}>Client</div>
          <div style={{ fontFamily: CORMORANT, fontSize: 24, color: '#1F333A', fontWeight: 400, marginTop: 4 }}>
            {info.name}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {info.address && <Field label="Address" value={info.address} />}
            {info.email && <Field label="Email" value={info.email} />}
            {info.phone && <Field label="Phone" value={info.phone} />}
            {info.howHeard && <Field label="How they heard" value={info.howHeard} />}
          </div>

          <div style={{ borderTop: '0.5px solid #E5DDD5', margin: '16px 0' }} />

          <div style={sectionLabel}>Closet Configuration</div>
          {closets.length === 0 ? (
            <div style={{ fontSize: 13, color: '#7A6E65', marginTop: 8 }}>No closet configuration on file.</div>
          ) : (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {closets.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: '#1F333A', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ ...fieldLabel, marginBottom: 2 }}>
                    {c.name?.trim() || `Closet ${i + 1}`}
                  </div>
                  <Row label="Type" value={`${c.shape}`} />
                  <Row label="Walls / Bays" value={`${c.walls} wall${c.walls === 1 ? '' : 's'} · ${c.bays} bay${c.bays === 1 ? '' : 's'}`} />
                  <Row label="Material" value={c.material} />
                  <Row label="Hardware" value={`${c.hardwareStyle} · ${c.hardwareColor}`} />
                  <Row label="Rod" value={c.rodColor} />
                  <Row label="Height" value={c.height} />
                  {(c.roomWidthDisplay || c.roomDepthDisplay || c.roomHeightDisplay) && (
                    <Row
                      label="Room"
                      value={`${c.roomWidthDisplay ?? '—'} W × ${c.roomDepthDisplay ?? '—'} D × ${c.roomHeightDisplay ?? '—'} H`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 14 }}>
            <span style={fieldLabel}>Estimated price</span>
            <span style={{ fontFamily: CORMORANT, fontSize: 26, color: '#1F333A', fontWeight: 400 }}>{grandTotal}</span>
          </div>

          <div style={{ fontSize: 12, color: '#7A6E65', marginTop: 6 }}>Submitted {info.createdLabel}</div>

          <div style={{ borderTop: '0.5px solid #E5DDD5', margin: '16px 0' }} />

          <div style={{ ...sectionLabel, marginBottom: 8 }}>Internal Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Internal notes..."
            rows={4}
            onFocus={(e) => (e.target.style.borderColor = '#C7AC90')}
            style={{
              width: '100%',
              border: '1px solid #E5DDD5',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              color: '#1F333A',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Schedule / reschedule modal */}
      {scheduleOpen && (
        <ScheduleModal
          job={{ id: info.id, name: info.name, address: info.address }}
          staff={staff}
          existingId={appointment?.id}
          onClose={() => setScheduleOpen(false)}
          onScheduled={() => {
            setScheduleOpen(false);
            showToast(appointment ? 'Appointment rescheduled ✓' : 'Appointment scheduled ✓');
            router.refresh();
          }}
        />
      )}

      {/* Photo modal */}
      {modalUrl && (
        <div
          onClick={() => setModalUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(31,51,58,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 50,
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={modalUrl} alt="Job photo" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#1F333A',
            color: '#EAE0D5',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13,
            zIndex: 60,
            boxShadow: '0 6px 24px rgba(31,51,58,0.25)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      <div style={{ fontSize: 13, color: '#1F333A', marginTop: 1 }}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: '#7A6E65' }}>{label}</span>
      <span style={{ color: '#1F333A', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
