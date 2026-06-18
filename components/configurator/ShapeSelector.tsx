'use client';

import type { ShapeOption } from '@/types';

// Simple top-down line-art of each footprint.
function ShapeIcon({ id }: { id: string }) {
  const common = {
    width: 40,
    height: 40,
    viewBox: '0 0 40 40',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  };
  if (id === 'l_shaped') {
    return (
      <svg {...common}>
        <path d="M10 8 v24 h22" />
      </svg>
    );
  }
  if (id === 'u_shaped') {
    return (
      <svg {...common}>
        <path d="M9 8 v24 h22 v-24" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M8 20 h24" />
    </svg>
  );
}

export default function ShapeSelector({
  shapes,
  selectedId,
  onSelect,
}: {
  shapes: ShapeOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Closet shape">
      {shapes.map((s) => {
        const active = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(s.id)}
            title={s.description}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition ${
              active ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-sand'
            }`}
          >
            <span className="text-ink">
              <ShapeIcon id={s.id} />
            </span>
            <span className="text-xs font-medium text-ink">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
