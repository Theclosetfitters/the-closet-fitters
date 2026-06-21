'use client';

import type { Catalog, SectionConfig } from '@/types';
import { formatCents, formatInches } from '@/lib/format';
import { maxWidthFor } from '@/lib/config';

interface Props {
  catalog: Catalog;
  section: SectionConfig;
  /** Global index in config.sections — used for stable test ids. */
  index: number;
  /** Display label within the wall, e.g. "Bay 1". */
  label: string;
  /** True when this side-wall corner bay can't be drawers (back-wall corner
   * bay at this corner already has a drawer bank). */
  drawersBlocked?: boolean;
  onChange: (id: string, patch: Partial<SectionConfig>) => void;
}

export default function SectionRow({
  catalog,
  section,
  index,
  label,
  drawersBlocked = false,
  onChange,
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
        <span className="font-display text-base font-semibold text-brand">{label}</span>
        <span className="text-sm font-semibold text-walnut">
          {formatCents(sectionTotal)}
        </span>
      </div>

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
          <option key={i.id} value={i.id} disabled={drawersBlocked && i.id === 'drawers'}>
            {i.label} — {formatCents(i.priceCents)}
          </option>
        ))}
      </select>
      {drawersBlocked && (
        <p className="mt-1 text-xs font-normal text-sand">
          Drawers cannot be placed in this bay — the back wall would prevent them
          from opening.
        </p>
      )}
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
        onChange={(e) => onChange(section.id, { widthIn: Number(e.target.value) })}
        className="mt-1 w-full accent-brand"
      />
      <div className="flex justify-between text-[10px] text-faint">
        <span>{formatInches(min)}</span>
        <span>max {formatInches(max)}</span>
      </div>

      {/* Back panel — highlighted option */}
      <div className="mt-3 rounded-lg border border-brand/30 bg-cream p-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={section.hasBack}
            onChange={(e) => onChange(section.id, { hasBack: e.target.checked })}
            className="mt-0.5 h-5 w-5 accent-brand"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              Add back panel{' '}
              <span className="font-normal text-muted">
                (+{formatCents(catalog.pricing.backPerSectionCents)})
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-sand">
              Adds a full back panel to close in the rear of your closet unit
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
