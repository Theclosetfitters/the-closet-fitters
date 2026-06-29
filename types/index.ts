// Core domain types for the closet configurator.
//
// The product is built from a left-to-right row of vertical SECTIONS. Each
// section has one interior layout and a customizable width (imperial inches,
// snapped to 1/8"). Pricing is per section; drawers cost more. Material color,
// hardware color, and height are global to the closet. Depth is fixed.

export type InteriorType =
  | 'long_hanging'
  | 'full_hanging'
  | 'double_hanging'
  | 'shoe_shelves'
  | 'adjustable_shelves'
  | 'drawers';

export type MaterialTexture = 'wood' | 'woven' | 'solid';

/** Closet footprint. Bays are distributed across the wall(s). */
export type ClosetShape = 'straight' | 'l_shaped' | 'u_shaped';

/** Which wall a bay belongs to. Straight uses A; L uses A/B; U uses A/B/C. */
export type WallId = 'A' | 'B' | 'C';

export type HardwareStyleId = 'modern_pull' | 'bar_pull' | 'edge_pull';

export interface ShapeOption {
  id: ClosetShape;
  label: string;
  description: string;
}

export interface HardwareStyleOption {
  id: HardwareStyleId;
  label: string;
  description: string;
}

/** One interior layout option for a section. */
export interface InteriorOption {
  id: InteriorType;
  code: string; // 'LH', 'DH', 'SS', 'AS', 'DR'
  label: string;
  description: string;
  /** Max section width (inches) for this interior. Drawers cap lower. */
  maxWidthIn: number;
  /** Price of a section with this interior, in cents. */
  priceCents: number;
}

/** A wood/woven color the whole closet is finished in (all same price). */
export interface MaterialOption {
  id: string;
  label: string;
  colorHex: string;
  texture: MaterialTexture;
  note?: string;
}

/** Rod + hardware color (all same price). */
export interface HardwareOption {
  id: string;
  label: string;
  colorHex: string;
}

export interface CatalogPricing {
  backPerSectionCents: number;
  heightUpgradePerFootCents: number;
  currency: string;
}

export interface CatalogConstraints {
  minWidthIn: number;
  standardMaxWidthIn: number;
  drawerMaxWidthIn: number;
  depthIn: number;
  standardHeightIn: number;
  upgradedHeightIn: number;
  stepIn: number;
  /** Standard top cap panel (fixed construction detail, no cost). */
  topCapIn: number;
  topCapDepthIn: number;
  topCapOverhangIn: number;
}

export interface Catalog {
  pricing: CatalogPricing;
  constraints: CatalogConstraints;
  interiors: InteriorOption[];
  materials: MaterialOption[];
  /** Shared finish colors used for both rods and drawer hardware. */
  hardware: HardwareOption[];
  shapes: ShapeOption[];
  hardwareStyles: HardwareStyleOption[];
}

/** One vertical section of the closet. */
export interface SectionConfig {
  id: string; // stable client id
  interior: InteriorType;
  widthIn: number; // snapped to 1/8"
  wall: WallId; // which wall this bay sits on (always 'A' for straight)
}

/**
 * A customer's configuration. This is the ONLY thing sent to the server for
 * pricing — never a price (CLAUDE.md #1). Shape, colors, and hardware style add
 * no cost; pricing is per bay regardless.
 */
export interface ClosetConfig {
  shape: ClosetShape;
  sections: SectionConfig[];
  materialId: string;
  rodColorId: string; // hanging-rod finish color
  hardwareColorId: string; // drawer pull/knob finish color
  hardwareStyleId: HardwareStyleId; // drawer pull/knob style
  heightUpgrade: boolean; // false = standard height, true = +1'
  /** All-or-nothing: when true, every bay gets a back panel (plus the L/U
   * corner panels, which are complimentary). Stored once for the whole closet. */
  backPanels: boolean;
}

export interface PriceLineItem {
  label: string;
  amountCents: number;
}

export interface PriceBreakdown {
  lineItems: PriceLineItem[];
  subtotalCents: number;
  totalCents: number;
  currency: string;
}

export type OrderStatus = 'received' | 'in_production' | 'ready' | 'completed';

export interface Order {
  id: string;
  userId: string | null;
  config: ClosetConfig;
  priceBreakdown: PriceBreakdown;
  totalCents: number;
  currency: string;
  status: OrderStatus;
  stripeSessionId: string | null;
  paid: boolean;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  referralSource: string | null;
  quoteRef: string | null;
  createdAt: string;
  updatedAt: string;
}
