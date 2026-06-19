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
    sections: (config.sections ?? []).map((s) => ({
      id: s.id ?? makeSectionId(),
      interior: (s.interior as InteriorType) ?? 'long_hanging',
      widthIn: typeof s.widthIn === 'number' ? s.widthIn : 24,
      hasBack: Boolean(s.hasBack),
      wall: s.wall && walls.includes(s.wall) ? s.wall : 'A',
    })),
  };
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
    hasBack: false,
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

/** Bay ids where drawers are NEVER allowed: the bay closest to the back-wall
 * corner on each side wall (index 0 of Wall B and Wall C). On L/U closets that
 * bay's drawer would be blocked from opening by the back wall cabinetry.
 *
 * Positional, not indexed by bay number — re-derived from `config` every call,
 * so it always tracks whichever bay currently sits at the corner. Straight
 * closets have no side walls, so the set is empty. */
export function restrictedDrawerBayIds(config: ClosetConfig): Set<string> {
  const ids = new Set<string>();
  if (config.shape !== 'l_shaped' && config.shape !== 'u_shaped') return ids;
  const cornerBay = (wall: WallId) => config.sections.find((s) => s.wall === wall);
  const b = cornerBay('B');
  if (b) ids.add(b.id);
  const c = cornerBay('C');
  if (c) ids.add(c.id);
  return ids;
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
