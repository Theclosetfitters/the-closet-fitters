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
  blockedIds,
  showCornerNote,
  onAddBay,
  onRemoveBay,
  onChange,
}: {
  catalog: Catalog;
  wall: WallId;
  label: string;
  bays: BaySlot[];
  /** Section ids whose drawers option must be disabled (side-wall corner bays). */
  blockedIds: Set<string>;
  /** Show the 8.5" corner filler note (side walls of an L/U closet). */
  showCornerNote: boolean;
  onAddBay: (wall: WallId) => void;
  onRemoveBay: (wall: WallId) => void;
  onChange: (id: string, patch: Partial<SectionConfig>) => void;
}) {
  const count = bays.length;
  // Display bays corner-first so "Bay 1" is always the bay at the back-wall
  // corner. Wall A / Wall C already come in that order (A[0] = leftmost,
  // C[0] = corner); Wall B is mirrored in the 3D layout (its corner bay is the
  // LAST in the array — same convention as the drawer-corner rule), so reverse
  // it. Then number sequentially: "Wall A — Bay 1", "Wall A — Bay 2", ...
  const orderedBays = wall === 'B' ? [...bays].reverse() : bays;
  return (
    <section className="space-y-3" aria-label={label}>
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink">{label}</h3>

      {showCornerNote && (
        <p className="rounded-lg bg-cream px-3 py-2 text-[11px] text-muted">
          Side wall cabinetry runs flush to the back wall. An 8.5&quot; clearance
          is maintained between the back wall cabinetry and the side wall
          cabinetry at each corner to allow full hanging depth on the side walls.
        </p>
      )}

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

      {orderedBays.map((b, i) => (
        <SectionRow
          key={b.section.id}
          catalog={catalog}
          section={b.section}
          index={b.index}
          label={`Wall ${wall} — Bay ${i + 1}`}
          drawersBlocked={blockedIds.has(b.section.id)}
          onChange={onChange}
        />
      ))}
    </section>
  );
}
