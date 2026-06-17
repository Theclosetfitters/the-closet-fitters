// Helpers for building and reading a ClosetConfig (section-based model).
import type { Catalog, ClosetConfig, InteriorType, SectionConfig } from '@/types';
import { roundToEighth } from '@/lib/format';

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

export function defaultSection(catalog: Catalog): SectionConfig {
  return {
    id: makeSectionId(),
    interior: 'long_hanging',
    widthIn: Math.min(24, catalog.constraints.standardMaxWidthIn),
    hasBack: false,
  };
}

export function defaultConfig(catalog: Catalog): ClosetConfig {
  return {
    sections: [defaultSection(catalog)],
    materialId: catalog.materials[0].id,
    hardwareId: catalog.hardware[0].id,
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
