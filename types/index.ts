// Core domain types for the closet configurator.
// These describe the catalog shape, a customer's configuration,
// the server-computed price breakdown, and orders.

export type ClosetTypeId = string;
export type OptionGroupId = string;
export type OptionId = string;

/** A single selectable option within an option group (e.g. a specific finish). */
export interface CatalogOption {
  id: OptionId;
  label: string;
  description?: string;
  /** Price contribution in cents. Interpreted according to the group's pricingModel. */
  priceCents: number;
}

/** How a group's selected option(s) contribute to the total price. */
export type PricingModel =
  | 'flat' // priceCents added once if selected
  | 'per_area' // priceCents multiplied by (width * height) in chosen units
  | 'per_unit'; // priceCents multiplied by a quantity the customer picks

/** A group of related options (materials, finishes, components, ...). */
export interface OptionGroup {
  id: OptionGroupId;
  label: string;
  /** 'single' = radio (one choice), 'multi' = checkboxes (many), 'quantity' = numeric. */
  selectionType: 'single' | 'multi' | 'quantity';
  pricingModel: PricingModel;
  required?: boolean;
  options: CatalogOption[];
}

/** A closet product type the customer starts from. */
export interface ClosetType {
  id: ClosetTypeId;
  label: string;
  description?: string;
  /** Base price in cents before any options. */
  basePriceCents: number;
  /** Allowed dimension ranges in centimeters. */
  dimensions: {
    width: { min: number; max: number; default: number };
    height: { min: number; max: number; default: number };
    depth: { min: number; max: number; default: number };
  };
  /** IDs of the option groups available for this closet type. */
  optionGroupIds: OptionGroupId[];
}

/** The full catalog seed shape. */
export interface Catalog {
  closetTypes: ClosetType[];
  optionGroups: OptionGroup[];
}

/** Dimensions chosen by the customer, in centimeters. */
export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

/**
 * A customer's in-progress or submitted configuration.
 * This is the ONLY thing sent to the server for pricing — never a price.
 */
export interface ClosetConfig {
  closetTypeId: ClosetTypeId;
  dimensions: Dimensions;
  /** groupId -> selected option id(s). For 'quantity' groups, value is { optionId: qty }. */
  selections: Record<OptionGroupId, OptionId[] | Record<OptionId, number>>;
}

/** One line in the itemized price breakdown. */
export interface PriceLineItem {
  label: string;
  amountCents: number;
}

/** Server-computed price result. */
export interface PriceBreakdown {
  lineItems: PriceLineItem[];
  subtotalCents: number;
  totalCents: number;
  currency: string;
}

export type OrderStatus =
  | 'received'
  | 'in_production'
  | 'ready'
  | 'completed';

/** A persisted order. */
export interface Order {
  id: string;
  userId: string | null; // null for guest checkout
  config: ClosetConfig;
  priceBreakdown: PriceBreakdown;
  totalCents: number;
  currency: string;
  status: OrderStatus;
  stripeSessionId: string | null;
  paid: boolean;
  customerEmail: string | null;
  createdAt: string;
  updatedAt: string;
}
