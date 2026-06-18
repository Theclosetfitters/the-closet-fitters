'use client';

import type { Catalog, SectionConfig } from '@/types';
import { formatCents, formatInches } from '@/lib/format';
import { maxWidthFor } from '@/lib/config';

interface Props {
  catalog: Catalog;
  section: SectionConfig;
  index: number;
  canRemove: boolean;
  onChange: (id: string, patch: Partial<SectionConfig>) => void;
  onRemove: (id: string) => void;
}

export default function SectionRow({
  catalog,
  section,
  index,
  canRemove,
  onChange,
  onRemove,
}: Props) {
  const interior = catalog.interiors.find((i) => i.id === section.interior)!;
  const max = maxWidthFor(catalog, section.interior);
  const min = catalog.constraints.minWidthIn;
  const sectionTotal =
    interior.priceCents + (section.hasBack ? catalog.pricing.backPerSectionCents : 0);

  return (
    <div
      data-testid={`section-${index}`}
      className="rounded-xl border border-zinc-200 bg-white p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-800">
          Section {index + 1}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-walnut">
            {formatCents(sectionTotal)}
          </span>
          {canRemove && (
            <button
              type="button"
              aria-label={`Remove section ${index + 1}`}
              onClick={() => onRemove(section.id)}
              className="h-6 w-6 rounded-full border border-zinc-300 text-zinc-500 hover:bg-zinc-100"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Interior */}
      <label className="block text-xs text-zinc-500">Inside</label>
      <select
        data-testid={`section-interior-${index}`}
        value={section.interior}
        onChange={(e) =>
          onChange(section.id, {
            interior: e.target.value as SectionConfig['interior'],
          })
        }
        className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
      >
        {catalog.interiors.map((i) => (
          <option key={i.id} value={i.id}>
            {i.label} — {formatCents(i.priceCents)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-zinc-400">{interior.description}</p>

      {/* Width */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-zinc-500">Width</span>
        <span className="font-medium tabular-nums text-zinc-700">
          {formatInches(section.widthIn)}
        </span>
      </div>
      <input
        data-testid={`section-width-${index}`}
        type="range"
        min={min}
        max={max}
        step={catalog.constraints.stepIn}
        value={section.widthIn}
        onChange={(e) =>
          onChange(section.id, { widthIn: Number(e.target.value) })
        }
        className="mt-1 w-full accent-brand"
      />
      <div className="flex justify-between text-[10px] text-zinc-400">
        <span>{formatInches(min)}</span>
        <span>max {formatInches(max)}</span>
      </div>

      {/* Back panel */}
      <label className="mt-2 flex cursor-pointer items-center justify-between text-xs">
        <span className="text-zinc-600">
          Add back panel{' '}
          <span className="text-zinc-400">
            (+{formatCents(catalog.pricing.backPerSectionCents)})
          </span>
        </span>
        <input
          type="checkbox"
          checked={section.hasBack}
          onChange={(e) => onChange(section.id, { hasBack: e.target.checked })}
          className="accent-brand"
        />
      </label>
    </div>
  );
}
