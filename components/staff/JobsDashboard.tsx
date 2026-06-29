'use client';

import { useState } from 'react';
import Link from 'next/link';

export type DashJob = {
  id: string;
  name: string;
  address: string;
  status: string;
  createdLabel: string;
  completedStages: number;
};

type StatusStyle = { label: string; bg: string; color: string; group: string };

const STATUS_CONFIG: Record<string, StatusStyle> = {
  new: { label: 'New', bg: '#EAF4EA', color: '#2D7A2D', group: 'new' },
  scheduled: { label: 'Scheduled', bg: '#EAF0FA', color: '#2D4FA8', group: 'scheduled' },
  invoiced: { label: 'In Progress', bg: '#FFF4E5', color: '#A05C00', group: 'in_progress' },
  signed: { label: 'In Progress', bg: '#FFF4E5', color: '#A05C00', group: 'in_progress' },
  in_production: { label: 'In Progress', bg: '#FFF4E5', color: '#A05C00', group: 'in_progress' },
  assembled: { label: 'In Progress', bg: '#FFF4E5', color: '#A05C00', group: 'in_progress' },
  delivered: { label: 'In Progress', bg: '#FFF4E5', color: '#A05C00', group: 'in_progress' },
  installed: { label: 'Installed', bg: '#F0EBE4', color: '#5E4F3E', group: 'complete' },
  complete: { label: 'Complete', bg: '#1F333A', color: '#EAE0D5', group: 'complete' },
};
const cfg = (status: string): StatusStyle => STATUS_CONFIG[status] ?? STATUS_CONFIG.new;

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'complete', label: 'Complete' },
];

const CORMORANT = 'var(--font-cormorant), Georgia, serif';

export default function JobsDashboard({ jobs, today }: { jobs: DashJob[]; today: string }) {
  const [tab, setTab] = useState('all');
  const filtered = tab === 'all' ? jobs : jobs.filter((j) => cfg(j.status).group === tab);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: CORMORANT, fontSize: 32, color: '#1F333A', margin: 0, fontWeight: 500 }}>
            Jobs
          </h1>
          <p style={{ fontSize: 14, color: '#7A6E65', marginTop: 2 }}>{today}</p>
        </div>
        <span
          style={{
            background: '#F0EBE4',
            border: '0.5px solid #C7AC90',
            borderRadius: 9999,
            padding: '4px 14px',
            fontSize: 12,
            color: '#5E4F3E',
            whiteSpace: 'nowrap',
          }}
        >
          {jobs.length} job{jobs.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* status filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '20px 0' }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                border: 'none',
                cursor: 'pointer',
                borderRadius: 9999,
                padding: '6px 16px',
                fontSize: 13,
                background: active ? '#1F333A' : 'transparent',
                color: active ? '#EAE0D5' : '#7A6E65',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* job list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <p style={{ fontFamily: CORMORANT, fontSize: 20, color: '#7A6E65', margin: 0 }}>No jobs yet</p>
          <p style={{ fontSize: 13, color: '#C7AC90', marginTop: 4 }}>
            New consultation submissions will appear here
          </p>
        </div>
      ) : (
        filtered.map((j) => {
          const c = cfg(j.status);
          return (
            <Link key={j.id} href={`/staff/jobs/${j.id}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div
                className="staff-job-card"
                style={{
                  background: 'white',
                  borderRadius: 12,
                  border: '0.5px solid #E5DDD5',
                  padding: '20px 24px',
                  marginBottom: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, color: '#1F333A', fontWeight: 500 }}>{j.name}</div>
                  {j.address && (
                    <div style={{ fontSize: 13, color: '#7A6E65', marginTop: 2 }}>{j.address}</div>
                  )}
                  <div style={{ fontSize: 12, color: '#C7AC90', marginTop: 4 }}>{j.createdLabel}</div>
                </div>
                <div style={{ minWidth: 120, textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      background: c.bg,
                      color: c.color,
                      borderRadius: 9999,
                      padding: '4px 12px',
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {c.label}
                  </span>
                  <div style={{ background: '#F0EBE4', height: 4, borderRadius: 9999, marginTop: 8, overflow: 'hidden' }}>
                    <div
                      style={{
                        background: '#C7AC90',
                        height: 4,
                        borderRadius: 9999,
                        width: `${Math.round((j.completedStages / 6) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })
      )}

      <style>{`.staff-job-card:hover{border-color:#C7AC90 !important;box-shadow:0 2px 12px rgba(31,51,58,0.07);}`}</style>
    </div>
  );
}
