'use client';

import type { HardwareOption } from '@/types';

interface Props {
  hardware: HardwareOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function HardwarePicker({
  hardware,
  selectedId,
  onSelect,
}: Props) {
  return (
    <div className="flex gap-2">
      {hardware.map((h) => {
        const active = h.id === selectedId;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h.id)}
            className={`flex flex-1 items-center gap-2 rounded-lg border p-2 text-left text-xs transition ${
              active ? 'border-amber-600 ring-1 ring-amber-600' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: h.colorHex }}
            />
            <span className="text-zinc-700">{h.label}</span>
          </button>
        );
      })}
    </div>
  );
}
