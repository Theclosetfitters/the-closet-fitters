// Generates a 2D top-down floor-plan SVG of the closet layout. Pure +
// dependency-light so it runs on the server (quote email, rasterizable) and the
// client (checkout + admin). Bays are equal-width cells; L/U shapes meet at
// square corner pieces. Used by components/BirdsEyeView.tsx and the email.
import type { Catalog, ClosetConfig, WallId } from '@/types';
import { wallLabel, wallsForShape } from '@/lib/config';

const LINE = '#1F333A'; // Cosmos
const FILL = '#ffffff';
const TAN = '#C7AC90';

const BAY = 46; // bay cell length (along the wall)
const DEP = 30; // closet depth (perpendicular)
const GAP = 16; // open 8.5" clearance notch at each corner (room width direction)
const M = 28; // outer margin
const PAD_TOP = 20; // room for a label above a run
const PAD_SIDE = 26; // room for a rotated label beside a vertical run

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function codeFor(catalog: Catalog, interior: string): string {
  return catalog.interiors.find((i) => i.id === interior)?.code ?? '?';
}

// Fixed legend order for the bird's-eye / diagram key (every bay type).
const LEGEND_ORDER = ['LH', 'DH', 'FH', 'SH', 'SS', 'DR'];

/** The full {code,label} key for all bay types, in a fixed order — shown under
 * every diagram so the acronyms always read the same everywhere. */
export function birdsEyeLegend(catalog: Catalog): { code: string; label: string }[] {
  return [...catalog.interiors]
    .map((i) => ({ code: i.code, label: i.label }))
    .sort((a, b) => LEGEND_ORDER.indexOf(a.code) - LEGEND_ORDER.indexOf(b.code));
}

function bayCell(x: number, y: number, w: number, h: number, code: string): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FILL}" stroke="${LINE}" stroke-width="1.5"/>` +
    `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="${TAN}">${esc(code)}</text>`
  );
}

function label(text: string, x: number, y: number, rotate = 0): string {
  const t = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : '';
  return (
    `<text x="${x}" y="${y}"${t} text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="${LINE}">${esc(text)}</text>`
  );
}

function svg(W: number, H: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" ` +
    `style="max-width:${W}px;height:auto" role="img" aria-label="Top-down closet layout">` +
    body +
    `</svg>`
  );
}

// Standard top cap, drawn BEHIND the bays: a Tan/Cosmos band that follows the
// back perimeter, overhangs the front slightly, and bridges the corner gaps so
// the unit reads as one capped piece. CAP_OVER is exaggerated a few px so the
// 0.5" overhang is visible at this scale.
const CAP_OVER = 4;
function capRect(x: number, y: number, w: number, h: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${TAN}" stroke="${LINE}" stroke-width="1.2"/>`;
}
function capCaption(cx: number, y: number): string {
  return (
    `<text x="${cx}" y="${y}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" ` +
    `font-size="9" fill="${LINE}">Top cap panel included — 0.75&quot; &#215; 15.5&quot; full width</text>`
  );
}

export function birdsEyeSvg(catalog: Catalog, config: ClosetConfig): string {
  const walls = wallsForShape(config.shape);
  const byWall = (w: WallId) => config.sections.filter((s) => s.wall === w);
  const codes = (w: WallId) => byWall(w).map((s) => codeFor(catalog, s.interior));

  if (config.shape === 'straight') {
    const a = codes('A');
    const n = Math.max(1, a.length);
    const w = n * BAY;
    const parts: string[] = [];
    parts.push(capRect(M, M, w, DEP + CAP_OVER)); // cap behind the bays
    a.forEach((c, i) => parts.push(bayCell(M + i * BAY, M, BAY, DEP, c)));
    parts.push(label('Wall A', M + w / 2, M + DEP + CAP_OVER + 14));
    const W = M * 2 + w;
    const H = M + DEP + CAP_OVER + 40;
    parts.push(capCaption(W / 2, H - 10));
    return svg(W, H, parts.join(''));
  }

  const ox = M + PAD_SIDE;
  const oy = M + PAD_TOP;
  const a = codes('A');
  const b = codes('B');
  const na = Math.max(1, a.length);
  const nb = Math.max(1, b.length);

  if (config.shape === 'l_shaped') {
    const parts: string[] = [];
    const aStartX = ox + DEP + GAP; // Wall A starts after Wall B + the open gap
    // Top cap (behind): Wall A run, Wall B run, and the corner-gap bridge.
    parts.push(capRect(aStartX, oy, na * BAY, DEP + CAP_OVER));
    parts.push(capRect(ox, oy, DEP + CAP_OVER, nb * BAY));
    parts.push(capRect(ox + DEP, oy, GAP, DEP + CAP_OVER));
    // Wall B runs down the left, flush to the back-wall line (top edge at oy).
    b.forEach((c, j) => parts.push(bayCell(ox, oy + j * BAY, DEP, BAY, c)));
    // Wall A runs along the back wall.
    a.forEach((c, i) => parts.push(bayCell(aStartX + i * BAY, oy, BAY, DEP, c)));
    parts.push(label('Wall A', aStartX + (na * BAY) / 2, oy - 8));
    parts.push(label('Wall B', ox - 9, oy + (nb * BAY) / 2, -90));
    const W = aStartX + na * BAY + M;
    const H = oy + Math.max(DEP + CAP_OVER, nb * BAY) + 28;
    parts.push(capCaption(W / 2, H - 10));
    return svg(W, H, parts.join(''));
  }

  // u_shaped
  const c = codes('C');
  const nc = Math.max(1, c.length);
  const aStartX = ox + DEP + GAP; // Wall A after Wall B + the left clearance gap
  const aEndX = aStartX + na * BAY; // right end of Wall A
  const cStartX = aEndX + GAP; // Wall C inner face after the right clearance gap
  const parts: string[] = [];
  // Top cap (behind): Wall A / B / C runs + both corner-gap bridges.
  parts.push(capRect(aStartX, oy, na * BAY, DEP + CAP_OVER));
  parts.push(capRect(ox, oy, DEP + CAP_OVER, nb * BAY));
  parts.push(capRect(cStartX - CAP_OVER, oy, DEP + CAP_OVER, nc * BAY));
  parts.push(capRect(ox + DEP, oy, GAP, DEP + CAP_OVER));
  parts.push(capRect(aEndX, oy, GAP, DEP + CAP_OVER));
  // Side walls flush to the back-wall line (top edge at oy); Wall A along the back.
  b.forEach((cc, j) => parts.push(bayCell(ox, oy + j * BAY, DEP, BAY, cc)));
  c.forEach((cc, j) => parts.push(bayCell(cStartX, oy + j * BAY, DEP, BAY, cc)));
  a.forEach((cc, i) => parts.push(bayCell(aStartX + i * BAY, oy, BAY, DEP, cc)));
  parts.push(label('Wall A', aStartX + (na * BAY) / 2, oy - 8));
  parts.push(label('Wall B', ox - 9, oy + (nb * BAY) / 2, -90));
  parts.push(label('Wall C', cStartX + DEP + 9, oy + (nc * BAY) / 2, 90));
  const W = cStartX + DEP + PAD_SIDE + M;
  const H = oy + Math.max(DEP + CAP_OVER, nb * BAY, nc * BAY) + 28;
  parts.push(capCaption(W / 2, H - 10));
  return svg(W, H, parts.join(''));
}
