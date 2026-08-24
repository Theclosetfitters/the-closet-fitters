// Shared closet drawing geometry. This module owns the numbers and ordering the
// elevation and bird's-eye views are built from, so the PDF (PDFKit) and the
// cart (SVG) can never drift. Renderers consume the returned layout; they do NOT
// re-derive positions. All vertical positions are REAL INCHES scaled by the
// drawing scale — never a percentage of bay height.
import type { Catalog, ClosetConfig, SectionConfig, WallId } from '@/types';
import { finishedHeightIn, wallsForShape } from '@/lib/config';

// §1 — shared geometry constants (inches)
export const TOP_CAP = 0.75; // tan cap across the top of every bay
export const TOP_SHELF = 12; // fixed shelf, measured DOWN from underside of top cap
export const CASE_BOTTOM = 0.75;
export const TOE_KICK = 2.5;
export const DRAWER_H = 10;
export const DRAWER_COUNT = 4;
export const ROD_DROP = 3.4; // rod sits this far below the shelf above it
export const WALL_GAP = 18; // visual gap (inches) between wall groups in the elevation

// scale bounds on a 524pt content width
export const CONTENT_WIDTH = 524;
export const MAX_SCALE = 2.31; // pt/inch
export const MIN_SCALE = 1.15; // pt/inch

// Shared line/fill styles (each renderer applies these itself).
export const STYLE = {
  bodyFill: '#FBF9F6',
  bodyStroke: '#1F333A',
  bodyStrokeW: 0.9,
  topCapFill: '#C7AC90',
  topCapStroke: '#1F333A',
  topCapStrokeW: 0.6,
  fixedShelf: '#1F333A',
  fixedShelfW: 1.3,
  fixedShelfInset: 1,
  adjShelf: '#8C837A',
  adjShelfW: 0.8,
  adjShelfDash: [1.1, 2.4] as [number, number],
  adjShelfInset: 3,
  rod: '#1F333A',
  rodW: 2.3,
  rodInset: 5,
  toeKickFill: '#EFE9E2',
  toeKickInset: 2.2,
  drawerFill: '#F4EFE9',
  drawerStroke: '#5E4F3E',
  drawerStrokeW: 0.8,
  drawerInset: 1,
  pull: '#5E4F3E',
  pullW: 1.6,
  pullWidthPt: 12,
  code: '#1F333A',
  wallLabel: '#4A7A9B',
  widthLabel: '#7A6E65',
  tan: '#C7AC90',
} as const;

// §6 — dimension formatting. Straight ' and " (not primes — some fonts drop U+2032).
export const FRACTIONS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞', ''];
export function formatDim(inches: number): string {
  const ft = Math.floor(inches / 12);
  const rem = inches - ft * 12;
  let whole = Math.floor(rem + 1e-6);
  let e = Math.round((rem - whole) * 8);
  let frac = FRACTIONS[e];
  if (e === 8) {
    whole += 1;
    frac = '';
  }
  if (whole === 0 && frac) return `${ft}' ${frac}"`;
  return `${ft}' ${whole}${frac ? ' ' + frac : ''}"`;
}

export const evenly = (a: number, b: number, n: number) =>
  Array.from({ length: n }, (_, i) => a + ((b - a) / (n + 1)) * (i + 1));

export const bayCode = (catalog: Catalog, interior: string): string =>
  catalog.interiors.find((i) => i.id === interior)?.code ?? '?';

export function bayHeightIn(catalog: Catalog, config: ClosetConfig): number {
  return finishedHeightIn(catalog, config); // 84.75 or 96.75
}
export const heightLabel = (catalog: Catalog, config: ClosetConfig) =>
  formatDim(bayHeightIn(catalog, config));

// §2 — interior line positions for one bay, in real inches from the bay top.
export type BayInterior = {
  code: string;
  fixedShelves: number[];
  adjShelves: number[];
  rods: number[];
  drawerTops: number[]; // top y of each full-overlay drawer front
  toeKickTop: number; // floor + CASE_BOTTOM
  floor: number; // top face of the case bottom
};

export function bayInterior(catalog: Catalog, interior: string, H: number): BayInterior {
  const interiorTop = TOP_CAP; // 0.75
  const shelf12 = TOP_CAP + TOP_SHELF; // 12.75
  const floor = H - TOE_KICK - CASE_BOTTOM; // top face of case bottom
  const mid = (interiorTop + floor) / 2;

  const fixedShelves: number[] = [];
  const adjShelves: number[] = [];
  const rods: number[] = [];
  const drawerTops: number[] = [];

  switch (interior) {
    case 'long_hanging': // LH
      fixedShelves.push(shelf12);
      rods.push(shelf12 + ROD_DROP);
      break;
    case 'double_hanging': // DH
      fixedShelves.push(shelf12, mid);
      rods.push(shelf12 + ROD_DROP, mid + ROD_DROP);
      break;
    case 'full_hanging': // FH
      fixedShelves.push(shelf12, mid);
      rods.push(shelf12 + ROD_DROP);
      adjShelves.push(...evenly(mid, floor, 2));
      break;
    case 'adjustable_shelves': // SH
      fixedShelves.push(shelf12, mid);
      adjShelves.push((shelf12 + mid) / 2, ...evenly(mid, floor, 2));
      break;
    case 'shoe_shelves': // SS — no top shelf
      fixedShelves.push(mid);
      adjShelves.push(...evenly(interiorTop, mid, 4), ...evenly(mid, floor, 4));
      break;
    case 'drawers': {
      // DR
      const stackTop = floor - DRAWER_COUNT * DRAWER_H;
      fixedShelves.push(shelf12);
      adjShelves.push((shelf12 + stackTop) / 2);
      for (let i = 0; i < DRAWER_COUNT; i++) drawerTops.push(stackTop + i * DRAWER_H);
      break;
    }
  }

  return {
    code: bayCode(catalog, interior),
    fixedShelves,
    adjShelves,
    rods,
    drawerTops,
    toeKickTop: floor + CASE_BOTTOM,
    floor,
  };
}

// §3 — wall order (LEFT | BACK | RIGHT). Left wall reversed so its bay 0 (corner,
// nearest the back) lands on the RIGHT edge, touching the back run. Right wall not
// reversed — its bay 0 is already on the left edge at the seam.
export type WallGroup = { id: 'left' | 'back' | 'right'; label: string; bays: SectionConfig[] };

export function elevationWallOrder(config: ClosetConfig): WallGroup[] {
  const byWall = (w: WallId) => config.sections.filter((s) => s.wall === w);
  if (config.shape === 'straight') {
    return [{ id: 'back', label: '', bays: byWall('A') }]; // straight: no wall label
  }
  const order: WallGroup[] = [];
  const left = byWall('B'); // left side wall
  const right = byWall('C'); // right side wall (U only)
  if (left.length) order.push({ id: 'left', label: 'LEFT WALL', bays: [...left].reverse() });
  order.push({ id: 'back', label: 'BACK WALL', bays: byWall('A') });
  if (right.length) order.push({ id: 'right', label: 'RIGHT WALL', bays: right });
  return order;
}

const groupInches = (g: WallGroup) => g.bays.reduce((a, b) => a + b.widthIn, 0);
const groupsFitScale = (gs: WallGroup[], maxWidth: number) => {
  const totalIn =
    gs.reduce((a, g) => a + groupInches(g), 0) + WALL_GAP * Math.max(0, gs.length - 1);
  return totalIn > 0 ? Math.min(maxWidth / totalIn, MAX_SCALE) : MAX_SCALE;
};

// A fully-positioned elevation, ready for either renderer. Coordinates in points,
// relative to the strip origin (0,0). Renderers offset by their own margins.
export type BayLayout = {
  section: SectionConfig;
  code: string;
  x: number;
  width: number; // points
  widthLabel: string;
};
export type GroupLayout = {
  id: WallGroup['id'];
  label: string;
  x: number;
  width: number;
  bays: BayLayout[];
};
export type ElevationPage = {
  groups: GroupLayout[];
  stripWidth: number; // points, before centering
  continuationNote?: string; // "Right wall continues on the following page"
};
export type ElevationPlan = {
  scale: number;
  split: boolean;
  H: number;
  bayHeight: number; // points
  pages: ElevationPage[];
};

function layoutGroups(groups: WallGroup[], scale: number): { groups: GroupLayout[]; stripWidth: number } {
  const gap = WALL_GAP * scale;
  let cx = 0;
  const laid: GroupLayout[] = groups.map((g, gi) => {
    if (gi > 0) cx += gap;
    const gx = cx;
    let bx = cx;
    const bays: BayLayout[] = g.bays.map((section) => {
      const width = section.widthIn * scale;
      const b: BayLayout = {
        section,
        code: '', // filled by caller (needs catalog)
        x: bx,
        width,
        widthLabel: formatDim(section.widthIn),
      };
      bx += width;
      return b;
    });
    const gw = bx - gx;
    cx = bx;
    return { id: g.id, label: g.label, x: gx, width: gw, bays };
  });
  return { groups: laid, stripWidth: cx };
}

export function elevationPlan(
  catalog: Catalog,
  config: ClosetConfig,
  maxWidth: number = CONTENT_WIDTH
): ElevationPlan {
  const groups = elevationWallOrder(config);
  const H = bayHeightIn(catalog, config);
  const fitScale = groupsFitScale(groups, maxWidth);
  const split = groups.length === 3 && fitScale < MIN_SCALE;

  const withCodes = (gl: GroupLayout[]): GroupLayout[] =>
    gl.map((g) => ({ ...g, bays: g.bays.map((b) => ({ ...b, code: bayCode(catalog, b.section.interior) })) }));

  if (!split) {
    const scale = fitScale;
    const { groups: laid, stripWidth } = layoutGroups(groups, scale);
    return {
      scale,
      split: false,
      H,
      bayHeight: H * scale,
      pages: [{ groups: withCodes(laid), stripWidth }],
    };
  }

  // U-shape split: page 1 = LEFT + BACK, page 2 = RIGHT. Shared scale.
  const left = groups.find((g) => g.id === 'left')!;
  const back = groups.find((g) => g.id === 'back')!;
  const right = groups.find((g) => g.id === 'right')!;
  const scale = Math.min(groupsFitScale([left, back], maxWidth), groupsFitScale([right], maxWidth));
  const p1 = layoutGroups([left, back], scale);
  const p2 = layoutGroups([right], scale);
  return {
    scale,
    split: true,
    H,
    bayHeight: H * scale,
    pages: [
      {
        groups: withCodes(p1.groups),
        stripWidth: p1.stripWidth,
        continuationNote: 'Right wall continues on the following page',
      },
      { groups: withCodes(p2.groups), stripWidth: p2.stripWidth },
    ],
  };
}

// Single continuous strip of every wall group (used by the cart, which never
// paginates). Same ordering/geometry as the PDF elevation.
export function elevationStrip(
  catalog: Catalog,
  config: ClosetConfig,
  maxWidth: number = CONTENT_WIDTH
): { scale: number; H: number; bayHeight: number; groups: GroupLayout[]; stripWidth: number } {
  const groups = elevationWallOrder(config);
  const H = bayHeightIn(catalog, config);
  const scale = groupsFitScale(groups, maxWidth);
  const { groups: laid, stripWidth } = layoutGroups(groups, scale);
  const withCodes = laid.map((g) => ({
    ...g,
    bays: g.bays.map((b) => ({ ...b, code: bayCode(catalog, b.section.interior) })),
  }));
  return { scale, H, bayHeight: H * scale, groups: withCodes, stripWidth };
}

// §4 — bird's-eye plan. Equal cells, no dimensions, no corner gaps. Coordinates in
// points relative to (0,0); renderers centre it.
export const BE_SIDE_W = 34;
export const BE_SIDE_H = 46;
export const BE_BACK_W = 50;
export const BE_BACK_H = 34;
export type BeCell = { x: number; y: number; w: number; h: number; code: string; rotated: boolean };
export type BeLabel = { text: string; x: number; y: number; rot: 0 | -90 | 90 };
export type BirdsEyePlan = { cells: BeCell[]; labels: BeLabel[]; width: number; height: number };

export function birdsEyePlan(catalog: Catalog, config: ClosetConfig): BirdsEyePlan {
  const byWall = (w: WallId) => config.sections.filter((s) => s.wall === w);
  const code = (s: SectionConfig) => bayCode(catalog, s.interior);
  const cells: BeCell[] = [];
  const labels: BeLabel[] = [];

  if (config.shape === 'straight') {
    const back = byWall('A');
    back.forEach((s, i) => cells.push({ x: i * BE_BACK_W, y: 0, w: BE_BACK_W, h: BE_BACK_H, code: code(s), rotated: false }));
    return { cells, labels, width: Math.max(1, back.length) * BE_BACK_W, height: BE_BACK_H };
  }

  const left = byWall('B'); // bay 0 nearest back → top of the left column
  const right = byWall('C');
  const back = byWall('A');

  const leftW = left.length ? BE_SIDE_W : 0;
  const rightW = right.length ? BE_SIDE_W : 0;
  const backW = Math.max(1, back.length) * BE_BACK_W;
  const width = leftW + backW + rightW;
  const backX = leftW;

  // Back run across the top.
  back.forEach((s, i) => cells.push({ x: backX + i * BE_BACK_W, y: 0, w: BE_BACK_W, h: BE_BACK_H, code: code(s), rotated: false }));
  // Left column (bay 0 at the top, touching the back run).
  left.forEach((s, i) => cells.push({ x: 0, y: i * BE_SIDE_H, w: BE_SIDE_W, h: BE_SIDE_H, code: code(s), rotated: true }));
  // Right column (bay 0 at the top).
  right.forEach((s, i) => cells.push({ x: leftW + backW, y: i * BE_SIDE_H, w: BE_SIDE_W, h: BE_SIDE_H, code: code(s), rotated: true }));

  const height = Math.max(BE_BACK_H, left.length * BE_SIDE_H, right.length * BE_SIDE_H);

  labels.push({ text: 'BACK', x: backX + backW / 2, y: -6, rot: 0 });
  if (left.length) labels.push({ text: 'LEFT', x: -6, y: (left.length * BE_SIDE_H) / 2, rot: -90 });
  if (right.length) labels.push({ text: 'RIGHT', x: width + 6, y: (right.length * BE_SIDE_H) / 2, rot: 90 });

  return { cells, labels, width, height };
}

// §5 — hardware pill logic (shared by the PDF and the cart).
export function hardwarePills(catalog: Catalog, config: ClosetConfig): string[] {
  const label = (arr: { id: string; label: string }[], id: string) =>
    arr.find((x) => x.id === id)?.label ?? id;
  const codes = config.sections.map((s) => bayCode(catalog, s.interior));
  const pills: string[] = [];
  if (codes.includes('DR')) {
    pills.push(label(catalog.hardwareStyles, config.hardwareStyleId));
    pills.push(label(catalog.hardware, config.hardwareColorId));
  }
  if (codes.some((c) => ['LH', 'FH', 'DH'].includes(c))) {
    pills.push(`${label(catalog.hardware, config.rodColorId)} rod`);
  }
  pills.push(`Height · ${heightLabel(catalog, config)}`);
  if (config.backPanels) pills.push('Back panels');
  return pills;
}

export function subLine(catalog: Catalog, config: ClosetConfig): string {
  const shape = catalog.shapes.find((s) => s.id === config.shape)?.label ?? config.shape;
  const n = config.sections.length;
  const finish = catalog.materials.find((m) => m.id === config.materialId)?.label ?? config.materialId;
  return `${shape} · ${n} bays · ${heightLabel(catalog, config)} · ${finish}`;
}

export function wallCount(config: ClosetConfig): number {
  return wallsForShape(config.shape).length;
}
