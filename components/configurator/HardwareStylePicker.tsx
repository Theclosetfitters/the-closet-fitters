'use client';

import type { HardwareStyleOption } from '@/types';

// Clean line-art (outlines only, no fill/shadow) for each pull style.
function StyleIcon({ id }: { id: string }) {
  const c = {
    width: 72,
    height: 40,
    viewBox: '0 0 72 40',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  };
  if (id === 'bar_pull') {
    // round cylindrical T-bar on two round posts (rounded profile)
    return (
      <svg {...c}>
        <rect x="12" y="11" width="48" height="6" rx="3" />
        <rect x="18" y="17" width="5" height="10" rx="2.5" />
        <rect x="49" y="17" width="5" height="10" rx="2.5" />
        <line x1="11" y1="30" x2="61" y2="30" />
      </svg>
    );
  }
  if (id === 'edge_pull') {
    // L-shaped edge pull: flat wide grip + a vertical lip that drops to the
    // drawer face (shown from a slight angle so the L reads).
    return (
      <svg {...c}>
        <path d="M14 20 L58 16 L60 19 L16 23 Z" />
        <path d="M14 20 L16 23 L16 32 L14 29 Z" />
        <circle cx="15" cy="28" r="1.2" />
      </svg>
    );
  }
  // modern pull: square-profile bar on two solid rectangular block posts
  return (
    <svg {...c}>
      <rect x="13" y="12" width="46" height="5" />
      <path d="M13 12 L15 10.5 L61 10.5 L59 12" />
      <rect x="17" y="17" width="5" height="10" />
      <rect x="50" y="17" width="5" height="10" />
      <line x1="11" y1="30" x2="61" y2="30" />
    </svg>
  );
}

export default function HardwareStylePicker({
  styles,
  selectedId,
  onSelect,
}: {
  styles: HardwareStyleOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Hardware style">
      {styles.map((s) => {
        const active = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(s.id)}
            title={s.description}
            className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition ${
              active ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-sand'
            }`}
          >
            <span className="text-ink">
              <StyleIcon id={s.id} />
            </span>
            <span className="text-[11px] font-medium leading-tight text-ink">
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
