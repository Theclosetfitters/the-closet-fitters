// Server-side pricing logic. This is the single source of truth for prices.
// RULE: prices are ALWAYS computed here on the server from the catalog +
// the customer's configuration. A price submitted by the client is never trusted.
import type {
  Catalog,
  ClosetConfig,
  OptionGroup,
  PriceBreakdown,
  PriceLineItem,
} from '@/types';

const CURRENCY = 'usd';

/** Square meters from centimeter dimensions (width * height of the front face). */
function frontAreaSqMeters(widthCm: number, heightCm: number): number {
  return (widthCm / 100) * (heightCm / 100);
}

/**
 * Compute the itemized price for a configuration.
 * Throws if the configuration references unknown catalog entries.
 */
export function computePrice(
  catalog: Catalog,
  config: ClosetConfig
): PriceBreakdown {
  const closetType = catalog.closetTypes.find(
    (t) => t.id === config.closetTypeId
  );
  if (!closetType) {
    throw new Error(`Unknown closet type: ${config.closetTypeId}`);
  }

  const groupById = new Map<string, OptionGroup>(
    catalog.optionGroups.map((g) => [g.id, g])
  );

  const lineItems: PriceLineItem[] = [
    { label: `${closetType.label} (base)`, amountCents: closetType.basePriceCents },
  ];

  const area = frontAreaSqMeters(
    config.dimensions.width,
    config.dimensions.height
  );

  for (const groupId of closetType.optionGroupIds) {
    const group = groupById.get(groupId);
    if (!group) continue;

    const selection = config.selections[groupId];
    if (!selection) continue;

    if (group.selectionType === 'quantity') {
      const quantities = selection as Record<string, number>;
      for (const [optionId, qty] of Object.entries(quantities)) {
        const option = group.options.find((o) => o.id === optionId);
        if (!option || qty <= 0) continue;
        lineItems.push({
          label: `${option.label} ×${qty}`,
          amountCents: option.priceCents * qty,
        });
      }
    } else {
      const optionIds = selection as string[];
      for (const optionId of optionIds) {
        const option = group.options.find((o) => o.id === optionId);
        if (!option) continue;
        const amountCents =
          group.pricingModel === 'per_area'
            ? Math.round(option.priceCents * area)
            : option.priceCents;
        lineItems.push({ label: option.label, amountCents });
      }
    }
  }

  const subtotalCents = lineItems.reduce((sum, li) => sum + li.amountCents, 0);

  return {
    lineItems,
    subtotalCents,
    totalCents: subtotalCents,
    currency: CURRENCY,
  };
}
