// Helpers for building and reading a ClosetConfig (section-based model).
import type {
  Catalog,
  ClosetConfig,
  ClosetShape,
  HardwareStyleId,
  InteriorType,
  SectionConfig,
  WallId,
} from '@/types';
import { roundToEighth } from '@/lib/format';

// A possibly-incomplete config (e.g. an older cart item from localStorage, or
// a config saved before shape/colors/wall existed).
type LegacyConfig = Partial<Omit<ClosetConfig, 'sections'>> & {
  hardwareId?: string; // pre-rename rod/hardware color
  sections?: Array<Partial<SectionConfig>>;
};

/** Fill in any missing fields with catalog defaults so a config is always valid. */
export function normalizeConfig(
  catalog: Catalog,
  config: LegacyConfig
): ClosetConfig {
  const shape: ClosetShape = config.shape ?? 'straight';
  const walls = wallsForShape(shape);
  const firstColor = catalog.hardware[0].id;
  return {
    shape,
    materialId: config.materialId ?? catalog.materials[0].id,
    rodColorId: config.rodColorId ?? config.hardwareId ?? firstColor,
    hardwareColorId: config.hardwareColorId ?? config.hardwareId ?? firstColor,
    hardwareStyleId:
      (config.hardwareStyleId as HardwareStyleId) ?? catalog.hardwareStyles[0].id,
    heightUpgrade: Boolean(config.heightUpgrade),
    // Single all-or-nothing flag. Migrate legacy per-bay back panels: if any
    // old section had a back, treat the whole closet as backs-on.
    backPanels:
      Boolean(config.backPanels) ||
      (config.sections ?? []).some((s) => (s as { hasBack?: boolean }).hasBack === true),
    sections: (config.sections ?? []).map((s) => ({
      id: s.id ?? makeSectionId(),
      interior: (s.interior as InteriorType) ?? 'long_hanging',
      widthIn: typeof s.widthIn === 'number' ? s.widthIn : 24,
      wall: s.wall && walls.includes(s.wall) ? s.wall : 'A',
    })),
    // Optional metadata — passed through untouched (never rounded).
    name: config.name,
    roomWidth: config.roomWidth,
    roomLength: config.roomLength,
    roomHeight: config.roomHeight,
    roomWidthDisplay: config.roomWidthDisplay,
    roomLengthDisplay: config.roomLengthDisplay,
    roomHeightDisplay: config.roomHeightDisplay,
  };
}

/** Cabinet carcass depth (in). The back wall's top cap is cut to fit between
 * the side-wall caps, so the back run only loses the carcass depth (15, not
 * 15.5). */
export const CABINET_DEPTH = 15;
/** Open clearance between a side wall and the back wall. */
export const CORNER_GAP = 8.5;

/** Maximum back-wall (Wall A) run for a shape, given the room width. Each side
 * cabinet sits flush against the back wall and eats its own depth + one corner
 * gap from the usable back run. Exact — never rounded. */
export function maxBackWallWidth(shape: ClosetShape, roomWidth: number): number {
  if (shape === 'l_shaped') return roomWidth - CABINET_DEPTH - CORNER_GAP; // roomWidth - 23.5
  if (shape === 'u_shaped') return roomWidth - 2 * CABINET_DEPTH - 2 * CORNER_GAP; // roomWidth - 47
  return roomWidth;
}

/** Side walls (B/C) are unobstructed — each is checked against the full room
 * length independently. */
export function maxSideWallWidth(roomLength: number): number {
  return roomLength;
}

/** Parse a room dimension string to exact decimal inches — NO rounding, any
 * fraction denominator accepted. Returns null if it can't be parsed. Used only
 * for room dimensions (never for bay widths). */
export function parseRoomDimension(val: string): number | null {
  const trimmed = val.trim();

  const feetMatch = trimmed.match(/^(\d+)['′]\s*(\d+(?:\.\d+)?)?\s*(?:(\d+)\/(\d+))?"?$/);
  if (feetMatch) {
    const feet = parseFloat(feetMatch[1]) || 0;
    const inches = parseFloat(feetMatch[2]) || 0;
    const num = parseFloat(feetMatch[3]) || 0;
    const denom = parseFloat(feetMatch[4]) || 1;
    const frac = denom > 0 ? num / denom : 0;
    return feet * 12 + inches + frac;
  }

  const inchMatch = trimmed.match(/^(\d+(?:\.\d+)?)"?$/);
  if (inchMatch) return parseFloat(inchMatch[1]);

  const mixedMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const denom = parseFloat(mixedMatch[3]);
    return whole + (denom > 0 ? num / denom : 0);
  }

  return null;
}

/** Which walls a shape has, in order. */
export function wallsForShape(shape: ClosetShape): WallId[] {
  if (shape === 'l_shaped') return ['A', 'B'];
  if (shape === 'u_shaped') return ['A', 'B', 'C'];
  return ['A'];
}

const WALL_LABELS: Record<WallId, string> = {
  A: 'Wall A',
  B: 'Wall B',
  C: 'Wall C',
};
export function wallLabel(wall: WallId): string {
  return WALL_LABELS[wall];
}

/** Wall label with a position hint for U-shaped closets. Used in both the
 * editor and the 3D viewer so they always read the same. */
export function wallDisplayLabel(shape: ClosetShape, wall: WallId): string {
  if (shape === 'u_shaped') {
    const pos: Record<WallId, string> = { A: 'Back', B: 'Left', C: 'Right' };
    return `${WALL_LABELS[wall]} (${pos[wall]})`;
  }
  return WALL_LABELS[wall];
}

/** Number of bays currently on a given wall. */
export function bayCountForWall(config: ClosetConfig, wall: WallId): number {
  return config.sections.filter((s) => s.wall === wall).length;
}

/** Generate a stable id for a section (browser or server safe). */
export function makeSectionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Max allowed width (inches) for a given interior. */
export function maxWidthFor(catalog: Catalog, interior: InteriorType): number {
  return (
    catalog.interiors.find((i) => i.id === interior)?.maxWidthIn ??
    catalog.constraints.standardMaxWidthIn
  );
}

/** Clamp + snap a width to the valid range for an interior. */
export function clampWidth(
  catalog: Catalog,
  interior: InteriorType,
  widthIn: number
): number {
  const min = catalog.constraints.minWidthIn;
  const max = maxWidthFor(catalog, interior);
  return roundToEighth(Math.min(max, Math.max(min, widthIn)));
}

export function defaultSection(
  catalog: Catalog,
  wall: WallId = 'A'
): SectionConfig {
  return {
    id: makeSectionId(),
    interior: 'long_hanging',
    widthIn: Math.min(24, catalog.constraints.standardMaxWidthIn),
    wall,
  };
}

export function defaultConfig(catalog: Catalog): ClosetConfig {
  return {
    shape: 'straight',
    sections: [defaultSection(catalog)],
    materialId: catalog.materials[0].id,
    rodColorId: catalog.hardware[0].id,
    hardwareColorId: catalog.hardware[0].id,
    hardwareStyleId: catalog.hardwareStyles[0].id,
    heightUpgrade: false,
    backPanels: false,
  };
}

/** Total run width (inches) across all sections. */
export function totalWidthIn(config: ClosetConfig): number {
  return config.sections.reduce((sum, s) => sum + s.widthIn, 0);
}

// --- Corner rules (L / U shapes) -------------------------------------------
// The back wall (A) meets a perpendicular side wall at each corner. The bay
// nearest the corner on each wall is its "corner bay". These helpers are pure
// and isomorphic so the configurator UI, the 3D viewer, and the server-side
// quote validation all agree on what a corner is.

/** Open clearance (inches) kept at every back-wall corner, measured in the room
 * width direction between Wall A's end bay and the side wall's inner face. The
 * side wall cabinetry runs flush to the back wall; this gap is empty space (no
 * panel) so clothes can hang the full depth on the side walls. */
export const CORNER_CLEARANCE_IN = 8.5;

/** The interior a corner bay falls back to when a drawer is illegally placed
 * there (matches the 3D viewer and the configurator's auto-reset). */
export const CORNER_DRAWER_FALLBACK: InteriorType = 'long_hanging';

/** Single source of truth for "is this the corner bay?" — POSITIONAL, never a
 * literal `index === 0`. The two side walls are MIRRORED in the 3D layout
 * (ClosetViewer `planWalls`): Wall B is rotated +90° and Wall C −90°, while each
 * wall's bays are laid out in the same array order. So the array→corner mapping
 * is opposite:
 *   - Wall B (left):  index 0 is the OPEN FRONT → corner = the LAST index
 *   - Wall C (right): index 0 IS the corner
 * The back wall (A) and straight closets have no corner. `index`/`count` are the
 * bay's position and total WITHIN its own wall. Every caller (configurator UI,
 * quote validation, both 2D renderers) must go through this — never hardcode 0.
 */
export function isCornerBay(wall: WallId, index: number, count: number): boolean {
  if (count <= 0) return false;
  if (wall === 'B') return index === count - 1; // left: corner is the last bay
  if (wall === 'C') return index === 0; // right: corner is the first bay
  return false; // back wall / straight closets have no corner bay
}

/** Ids of the bays physically at a back-wall corner (Wall B + Wall C on L/U
 * closets; empty for straight). A corner bay can never hold drawers — the back
 * wall cabinetry would block them from opening. Re-derived from `config` every
 * call (no stored index) via {@link isCornerBay}, so it always tracks the
 * current corner as bay counts change. */
export function cornerBayIds(config: ClosetConfig): Set<string> {
  const ids = new Set<string>();
  if (config.shape !== 'l_shaped' && config.shape !== 'u_shaped') return ids;
  for (const wall of ['B', 'C'] as WallId[]) {
    const bays = config.sections.filter((s) => s.wall === wall);
    bays.forEach((s, i) => {
      if (isCornerBay(wall, i, bays.length)) ids.add(s.id);
    });
  }
  return ids;
}

/** Back-compat alias — the set of bays whose "drawers" option must be blocked. */
export const restrictedDrawerBayIds = cornerBayIds;

/** Config sections with any corner-placed drawer coerced to the fallback
 * interior. This is the enforcement point that stops a drawer in a corner from
 * reaching the PDF, the cart, or the 2D geometry even if the UI is bypassed —
 * every rendering path derives its bays from this, not from raw sections. */
export function guardedSections(config: ClosetConfig): SectionConfig[] {
  const ids = cornerBayIds(config);
  if (ids.size === 0) return config.sections;
  return config.sections.map((s) =>
    ids.has(s.id) && s.interior === 'drawers' ? { ...s, interior: CORNER_DRAWER_FALLBACK } : s
  );
}

export function heightInches(catalog: Catalog, config: ClosetConfig): number {
  return config.heightUpgrade
    ? catalog.constraints.upgradedHeightIn
    : catalog.constraints.standardHeightIn;
}

/** Total finished height incl. the standard top cap panel (base + 0.75").
 * The base height drives geometry + pricing; the cap is added for display. */
export function finishedHeightIn(catalog: Catalog, config: ClosetConfig): number {
  return heightInches(catalog, config) + catalog.constraints.topCapIn;
}

/** Finished height as feet + fractional inches, dropping a 0 whole-inch:
 * 84.75 -> `7' 3/4"`, 96.75 -> `8' 3/4"`. This is what the customer sees. */
export function finishedHeightLabel(catalog: Catalog, config: ClosetConfig): string {
  const total = roundToEighth(finishedHeightIn(catalog, config));
  const feet = Math.floor(total / 12);
  const remIn = total - feet * 12;
  const whole = Math.floor(remIn);
  const eighths = Math.round((remIn - whole) * 8);
  let frac = '';
  if (eighths > 0) {
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    const g = gcd(eighths, 8);
    frac = `${eighths / g}/${8 / g}`;
  }
  const inchParts: string[] = [];
  if (whole > 0) inchParts.push(String(whole));
  if (frac) inchParts.push(frac);
  const inchStr = inchParts.length ? `${inchParts.join(' ')}"` : '';
  if (feet > 0) return inchStr ? `${feet}' ${inchStr}` : `${feet}'`;
  return inchStr || `0"`;
}
