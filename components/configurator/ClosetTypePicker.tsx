'use client';

import type { ClosetType } from '@/types';
import { formatCents } from '@/lib/format';

interface Props {
  closetTypes: ClosetType[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function ClosetTypePicker({
  closetTypes,
  selectedId,
  onSelect,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {closetTypes.map((type) => {
        const active = type.id === selectedId;
        return (
          <button
            key={type.id}
            type="button"
            onClick={() => onSelect(type.id)}
            className={`rounded-xl border p-4 text-left transition ${
              active
                ? 'border-amber-600 bg-amber-50 ring-1 ring-amber-600'
                : 'border-zinc-200 bg-white hover:border-zinc-300'
            }`}
          >
            <div className="font-medium text-zinc-900">{type.label}</div>
            <div className="mt-1 text-xs text-zinc-500">{type.description}</div>
            <div className="mt-2 text-sm font-semibold text-amber-700">
              from {formatCents(type.basePriceCents)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
