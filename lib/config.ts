// Helpers for building and reading a ClosetConfig.
import type { Catalog, ClosetConfig, OptionGroup } from '@/types';

/** Build a sensible default configuration for a closet type. */
export function defaultConfig(
  catalog: Catalog,
  closetTypeId: string
): ClosetConfig {
  const closetType =
    catalog.closetTypes.find((t) => t.id === closetTypeId) ??
    catalog.closetTypes[0];

  const groupById = new Map<string, OptionGroup>(
    catalog.optionGroups.map((g) => [g.id, g])
  );

  const selections: ClosetConfig['selections'] = {};
  for (const groupId of closetType.optionGroupIds) {
    const group = groupById.get(groupId);
    if (!group) continue;
    if (group.selectionType === 'single') {
      // Required single groups default to their first option.
      selections[groupId] = group.required ? [group.options[0].id] : [];
    } else if (group.selectionType === 'multi') {
      selections[groupId] = [];
    } else {
      // quantity
      selections[groupId] = {};
    }
  }

  return {
    closetTypeId: closetType.id,
    dimensions: {
      width: closetType.dimensions.width.default,
      height: closetType.dimensions.height.default,
      depth: closetType.dimensions.depth.default,
    },
    selections,
  };
}

/** Total quantity selected across all options in a quantity group. */
export function groupQuantityTotal(
  config: ClosetConfig,
  groupId: string
): number {
  const sel = config.selections[groupId];
  if (!sel || Array.isArray(sel)) return 0;
  return Object.values(sel).reduce((a, b) => a + b, 0);
}
