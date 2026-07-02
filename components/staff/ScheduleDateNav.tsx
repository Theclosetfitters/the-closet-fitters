'use client';

import { useRouter } from 'next/navigation';
import { addDays } from '@/lib/staff/scheduling';

export default function ScheduleDateNav({ date }: { date: string }) {
  const router = useRouter();
  const go = (d: string) => router.push(`/staff/schedule?date=${d}`);

  const arrow: React.CSSProperties = {
    border: '1px solid #E5DDD5',
    background: 'white',
    borderRadius: 8,
    width: 34,
    height: 34,
    cursor: 'pointer',
    color: '#1F333A',
    fontSize: 15,
    lineHeight: 1,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
      <button type="button" aria-label="Previous day" onClick={() => go(addDays(date, -1))} style={arrow}>
        ←
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && go(e.target.value)}
        style={{
          border: '1px solid #E5DDD5',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 14,
          color: '#1F333A',
          outline: 'none',
        }}
      />
      <button type="button" aria-label="Next day" onClick={() => go(addDays(date, 1))} style={arrow}>
        →
      </button>
    </div>
  );
}
