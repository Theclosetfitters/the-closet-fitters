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

/** Distinct {code,label} for the interiors used in this config, in catalog order. */
export function birdsEyeLegend(
  catalog: Catalog,
  config: ClosetConfig
): { code: string; label: string }[] {
  const used = new Set(config.sections.map((s) => s.interior));
  return catalog.interiors
    .filter((i) => used.has(i.id))
    .map((i) => ({ code: i.code, label: i.label }));
}

function bayCell(x: number, y: number, w: number, h: number, code: string): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FILL}" stroke="${LINE}" stroke-width="1.5"/>` +
    `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="${TAN}">${esc(code)}</text>`
  );
}

// Open 8.5" clearance notch at a corner, between Wall A's end (x2) and a side
// wall's inner face (x1). Drawn as a Tan dimension marker only — no fill, since
// the space is empty hanging clearance.
function gapMarker(x1: number, x2: number, yTop: number, h: number): string {
  const cx = (x1 + x2) / 2;
  const cy = yTop + h / 2;
  return (
    `<line x1="${x1}" y1="${yTop + 3}" x2="${x2}" y2="${yTop + 3}" stroke="${TAN}" stroke-width="1.2"/>` +
    `<line x1="${x1}" y1="${yTop + h - 3}" x2="${x2}" y2="${yTop + h - 3}" stroke="${TAN}" stroke-width="1.2"/>` +
    `<text x="${cx}" y="${cy}" transform="rotate(-90 ${cx} ${cy})" text-anchor="middle" ` +
    `dominant-baseline="central" font-family="system-ui,sans-serif" font-size="8" font-weight="700" fill="${TAN}">8.5&quot;</text>`
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

export function birdsEyeSvg(catalog: Catalog, config: ClosetConfig): string {
  const walls = wallsForShape(config.shape);
  const byWall = (w: WallId) => config.sections.filter((s) => s.wall === w);
  const codes = (w: WallId) => byWall(w).map((s) => codeFor(catalog, s.interior));

  if (config.shape === 'straight') {
    const a = codes('A');
    const n = Math.max(1, a.length);
    const parts = a.map((c, i) => bayCell(M + i * BAY, M, BAY, DEP, c)).join('');
    const W = M * 2 + n * BAY;
    const H = M + DEP + 26;
    return svg(W, H, parts + label('Wall A', M + (n * BAY) / 2, M + DEP + 14));
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
    // Wall B runs down the left, flush to the back-wall line (top edge at oy).
    b.forEach((c, j) => parts.push(bayCell(ox, oy + j * BAY, DEP, BAY, c)));
    // Wall A runs along the back wall.
    a.forEach((c, i) => parts.push(bayCell(aStartX + i * BAY, oy, BAY, DEP, c)));
    // Open clearance notch between Wall B's inner face and Wall A's end.
    parts.push(gapMarker(ox + DEP, aStartX, oy, DEP));
    parts.push(label('Wall A', aStartX + (na * BAY) / 2, oy - 8));
    parts.push(label('Wall B', ox - 9, oy + (nb * BAY) / 2, -90));
    const W = aStartX + na * BAY + M;
    const H = oy + Math.max(DEP, nb * BAY) + M;
    return svg(W, H, parts.join(''));
  }

  // u_shaped
  const c = codes('C');
  const nc = Math.max(1, c.length);
  const aStartX = ox + DEP + GAP; // Wall A after Wall B + the left clearance gap
  const aEndX = aStartX + na * BAY; // right end of Wall A
  const cStartX = aEndX + GAP; // Wall C inner face after the right clearance gap
  const parts: string[] = [];
  // Side walls flush to the back-wall line (top edge at oy); Wall A along the back.
  b.forEach((cc, j) => parts.push(bayCell(ox, oy + j * BAY, DEP, BAY, cc)));
  c.forEach((cc, j) => parts.push(bayCell(cStartX, oy + j * BAY, DEP, BAY, cc)));
  a.forEach((cc, i) => parts.push(bayCell(aStartX + i * BAY, oy, BAY, DEP, cc)));
  // Open clearance notches at both corners.
  parts.push(gapMarker(ox + DEP, aStartX, oy, DEP));
  parts.push(gapMarker(aEndX, cStartX, oy, DEP));
  parts.push(label('Wall A', aStartX + (na * BAY) / 2, oy - 8));
  parts.push(label('Wall B', ox - 9, oy + (nb * BAY) / 2, -90));
  parts.push(label('Wall C', cStartX + DEP + 9, oy + (nc * BAY) / 2, 90));
  const W = cStartX + DEP + PAD_SIDE + M;
  const H = oy + Math.max(DEP, nb * BAY, nc * BAY) + M;
  return svg(W, H, parts.join(''));
}
