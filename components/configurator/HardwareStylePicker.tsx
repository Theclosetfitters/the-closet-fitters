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
    // straight cylindrical bar on two posts
    return (
      <svg {...c}>
        <line x1="14" y1="14" x2="58" y2="14" />
        <path d="M20 14 v8 M52 14 v8" />
        <line x1="10" y1="30" x2="62" y2="30" />
      </svg>
    );
  }
  if (id === 'edge_pull') {
    // tapered angled edge-pull, thin profile
    return (
      <svg {...c}>
        <path d="M12 16 L60 16 L60 22 L12 26 Z" />
        <line x1="12" y1="30" x2="60" y2="30" />
      </svg>
    );
  }
  // modern pull: recessed rectangular pull with an angled channel
  return (
    <svg {...c}>
      <rect x="14" y="12" width="44" height="16" rx="2" />
      <path d="M22 24 L50 16" />
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
