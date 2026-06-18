'use client';

import type { Catalog, SectionConfig, WallId } from '@/types';
import SectionRow from '@/components/configurator/SectionRow';

interface BaySlot {
  section: SectionConfig;
  index: number; // global index in config.sections (stable test ids)
}

export default function WallSection({
  catalog,
  wall,
  label,
  bays,
  onAddBay,
  onRemoveBay,
  onChange,
}: {
  catalog: Catalog;
  wall: WallId;
  label: string;
  bays: BaySlot[];
  onAddBay: (wall: WallId) => void;
  onRemoveBay: (wall: WallId) => void;
  onChange: (id: string, patch: Partial<SectionConfig>) => void;
}) {
  const count = bays.length;
  return (
    <section className="space-y-3" aria-label={label}>
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink">{label}</h3>

      {/* Bay count stepper */}
      <div className="flex items-center justify-between rounded-xl border border-line bg-card px-3 py-2">
        <span className="text-sm text-muted">Number of bays</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`Remove a bay from ${label}`}
            data-testid={`remove-bay-${wall}`}
            onClick={() => onRemoveBay(wall)}
            disabled={count <= 1}
            className="h-7 w-7 rounded-full border border-line text-muted hover:bg-cream disabled:opacity-40"
          >
            −
          </button>
          <span className="w-5 text-center text-sm font-semibold tabular-nums text-ink">
            {count}
          </span>
          <button
            type="button"
            aria-label={`Add a bay to ${label}`}
            data-testid={`add-bay-${wall}`}
            onClick={() => onAddBay(wall)}
            className="h-7 w-7 rounded-full bg-ink text-cream hover:opacity-90"
          >
            +
          </button>
        </div>
      </div>

      {bays.map((b, i) => (
        <SectionRow
          key={b.section.id}
          catalog={catalog}
          section={b.section}
          index={b.index}
          label={`Bay ${i + 1}`}
          onChange={onChange}
        />
      ))}
    </section>
  );
}
