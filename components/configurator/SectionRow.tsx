'use client';

import type { Catalog, SectionConfig, WallId } from '@/types';
import { formatCents, formatInches, } from '@/lib/format';
import { maxWidthFor, wallLabel } from '@/lib/config';

interface Props {
  catalog: Catalog;
  section: SectionConfig;
  index: number;
  canRemove: boolean;
  walls: WallId[];
  onChange: (id: string, patch: Partial<SectionConfig>) => void;
  onRemove: (id: string) => void;
}

export default function SectionRow({
  catalog,
  section,
  index,
  canRemove,
  walls,
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
      className="rounded-xl border border-line bg-card p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">
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
              className="h-6 w-6 rounded-full border border-line text-muted hover:bg-cream"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Wall (L/U shapes only) */}
      {walls.length > 1 && (
        <div className="mb-2">
          <label className="block text-xs text-muted">Wall</label>
          <select
            data-testid={`section-wall-${index}`}
            value={section.wall}
            onChange={(e) =>
              onChange(section.id, { wall: e.target.value as WallId })
            }
            className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm"
          >
            {walls.map((w) => (
              <option key={w} value={w}>
                {wallLabel(w)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Interior */}
      <label className="block text-xs text-muted">Inside</label>
      <select
        data-testid={`section-interior-${index}`}
        value={section.interior}
        onChange={(e) =>
          onChange(section.id, {
            interior: e.target.value as SectionConfig['interior'],
          })
        }
        className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm"
      >
        {catalog.interiors.map((i) => (
          <option key={i.id} value={i.id}>
            {i.label} — {formatCents(i.priceCents)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-faint">{interior.description}</p>

      {/* Width */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted">Width</span>
        <span className="font-medium tabular-nums text-ink">
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
      <div className="flex justify-between text-[10px] text-faint">
        <span>{formatInches(min)}</span>
        <span>max {formatInches(max)}</span>
      </div>

      {/* Back panel */}
      <label className="mt-2 flex cursor-pointer items-center justify-between text-xs">
        <span className="text-muted">
          Add back panel{' '}
          <span className="text-faint">
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
