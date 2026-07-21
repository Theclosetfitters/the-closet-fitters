'use client';

import { useRef, useState } from 'react';
import type { Catalog, SectionConfig } from '@/types';
import { formatCents, formatInches } from '@/lib/format';
import { maxWidthFor } from '@/lib/config';

// Parse a width entry to inches. Accepts whole/decimal inches ("24", "18.5"),
// inch fractions ("23 3/8"), feet+inches ("2'0\""), and feet+fractions
// ("1'6 1/8"). Returns null if it can't be parsed.
function parseDimension(val: string): number | null {
  const trimmed = val.trim();

  // feet + optional inches + optional fraction, e.g. "2'6 3/8" / "2' 0"
  const feetMatch = trimmed.match(/^(\d+)'\s*(\d+)?\s*(?:(\d+)\/(\d+))?/);
  if (feetMatch) {
    const feet = parseInt(feetMatch[1]) || 0;
    const inches = parseInt(feetMatch[2]) || 0;
    const num = parseInt(feetMatch[3]) || 0;
    const denom = parseInt(feetMatch[4]) || 1;
    const frac = denom > 0 ? num / denom : 0;
    return feet * 12 + inches + frac;
  }

  // inches + optional fraction, e.g. "23 3/8" / "18.5" / "24"
  const inchMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:(\d+)\/(\d+))?$/);
  if (inchMatch) {
    const whole = parseFloat(inchMatch[1]) || 0;
    const num = parseInt(inchMatch[2]) || 0;
    const denom = parseInt(inchMatch[3]) || 1;
    const frac = denom > 0 ? num / denom : 0;
    return whole + frac;
  }

  return null;
}

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
  const sectionTotal = interior.priceCents;

  // --- Inline width editing (double-click / double-tap the width label) ----
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const skipCommit = useRef(false); // guards Escape/Enter from an extra blur commit
  const lastTap = useRef(0);

  const startEditing = () => {
    skipCommit.current = false;
    setInputValue(String(section.widthIn));
    setEditing(true);
  };
  const doCommit = () => {
    const parsed = parseDimension(inputValue);
    // Reject unparseable / out of range (6"–60") — revert to the original value.
    if (parsed !== null && parsed >= 6 && parsed <= 60) {
      // Round to the nearest 1/8"; updateSection re-clamps to this bay's range.
      onChange(section.id, { widthIn: Math.round(parsed * 8) / 8 });
    }
  };
  const commitAndClose = () => {
    doCommit();
    skipCommit.current = true;
    setEditing(false);
  };
  const cancelEdit = () => {
    skipCommit.current = true;
    setEditing(false);
  };
  const onBlurCommit = () => {
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    doCommit();
    setEditing(false);
  };
  const handleTouchStart = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) startEditing();
    lastTap.current = now;
  };

  return (
    <div
      data-testid={`section-${index}`}
      className="rounded-xl border border-line bg-card p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-semibold text-brand">{label}</span>
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
        {editing ? (
          <input
            data-testid={`section-width-input-${index}`}
            type="text"
            inputMode="text"
            value={inputValue}
            autoFocus
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={onBlurCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitAndClose();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
            }}
            aria-label="Bay width in inches"
            className="font-medium tabular-nums text-ink"
            style={{
              width: 60,
              textAlign: 'center',
              border: 'none',
              borderBottom: '1px solid #C7AC90',
              background: 'transparent',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onDoubleClick={startEditing}
            onTouchStart={handleTouchStart}
            title="Double-click to edit width"
            className="cursor-text font-medium tabular-nums text-ink underline-offset-2 decoration-dotted hover:underline"
          >
            {formatInches(section.widthIn)}
          </span>
        )}
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
    </div>
  );
}
