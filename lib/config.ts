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

export function heightInches(catalog: Catalog, config: ClosetConfig): number {
  return config.heightUpgrade
    ? catalog.constraints.upgradedHeightIn
    : catalog.constraints.standardHeightIn;
}
