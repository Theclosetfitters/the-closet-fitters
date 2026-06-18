'use client';

import type { MaterialOption } from '@/types';

interface Props {
  materials: MaterialOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function MaterialPicker({
  materials,
  selectedId,
  onSelect,
}: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {materials.map((m) => {
        const active = m.id === selectedId;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            title={m.note ? `${m.label} — ${m.note}` : m.label}
            className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition ${
              active ? 'border-brand ring-1 ring-brand' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <span
              className="h-10 w-full rounded-md border border-black/10 bg-cover bg-center"
              style={{
                backgroundColor: m.colorHex,
                backgroundImage: `url(/textures/${m.id}.jpg)`,
              }}
            />
            <span className="text-[10px] leading-tight text-zinc-600">
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
