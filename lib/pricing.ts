// Server-side pricing logic — the single source of truth for prices.
// RULE (CLAUDE.md #1): prices are ALWAYS computed here from the catalog + the
// customer's configuration. A price submitted by the client is never trusted.
import type { Catalog, ClosetConfig, PriceBreakdown, PriceLineItem } from '@/types';
import { formatInches, roundToEighth } from '@/lib/format';

/** Total run width (inches) across all sections. */
export function totalWidthIn(config: ClosetConfig): number {
  return config.sections.reduce((sum, s) => sum + s.widthIn, 0);
}

/**
 * Compute the itemized price for a configuration.
 * - Each section costs its interior's price ($500, or $1,500 for drawers).
 * - A back panel adds a flat per-section amount.
 * - Raising the height adds a per-linear-foot amount over the whole run.
 * Throws if the configuration references unknown catalog entries.
 */
export function computePrice(
  catalog: Catalog,
  config: ClosetConfig
): PriceBreakdown {
  if (!config.sections || config.sections.length === 0) {
    throw new Error('A closet needs at least one section');
  }

  const interiorById = new Map(catalog.interiors.map((i) => [i.id, i]));
  const lineItems: PriceLineItem[] = [];

  config.sections.forEach((section, idx) => {
    const interior = interiorById.get(section.interior);
    if (!interior) {
      throw new Error(`Unknown interior: ${section.interior}`);
    }
    lineItems.push({
      label: `Section ${idx + 1}: ${interior.label} · ${formatInches(
        roundToEighth(section.widthIn)
      )}`,
      amountCents: interior.priceCents,
    });
  });

  // Back panels — a single all-or-nothing option for the whole closet. Price is
  // bays × $200 for every shape; the L/U corner panels are complimentary.
  if (config.backPanels) {
    const bays = config.sections.length;
    const corners =
      config.shape === 'l_shaped' ? 1 : config.shape === 'u_shaped' ? 2 : 0;
    const cornerNote = corners
      ? ` + ${corners} corner panel${corners === 1 ? '' : 's'} (included)`
      : '';
    lineItems.push({
      label: `Back Panels — ${bays} bay${bays === 1 ? '' : 's'}${cornerNote}`,
      amountCents: bays * catalog.pricing.backPerSectionCents,
    });
  }

  if (config.heightUpgrade) {
    const widthIn = totalWidthIn(config);
    const feet = widthIn / 12;
    const amountCents = Math.round(
      catalog.pricing.heightUpgradePerFootCents * feet
    );
    lineItems.push({
      label: `Raise to 8' · over ${formatInches(widthIn)} of width`,
      amountCents,
    });
  }

  const subtotalCents = lineItems.reduce((sum, li) => sum + li.amountCents, 0);

  return {
    lineItems,
    subtotalCents,
    totalCents: subtotalCents,
    currency: catalog.pricing.currency,
  };
}
