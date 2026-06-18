// Generates a 2D top-down floor-plan SVG of the closet layout. Pure +
// dependency-light so it runs on the server (quote email, rasterizable) and the
// client (checkout + admin). Bays are equal-width cells; L/U shapes meet at
// square corner pieces. Used by components/BirdsEyeView.tsx and the email.
import type { Catalog, ClosetConfig, WallId } from '@/types';
import { wallLabel, wallsForShape } from '@/lib/config';

const LINE = '#1F333A'; // Cosmos
const FILL = '#ffffff';
const CORNER = '#EAE0D5'; // Cream
const TAN = '#C7AC90';

const BAY = 46; // bay cell length (along the wall)
const DEP = 30; // closet depth (perpendicular)
const GAP = 16; // 8.5" corner filler cell (along the back wall)
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

function cornerPiece(x: number, y: number): string {
  return (
    `<rect x="${x}" y="${y}" width="${DEP}" height="${DEP}" fill="${CORNER}" stroke="${LINE}" stroke-width="1.5"/>` +
    `<line x1="${x}" y1="${y}" x2="${x + DEP}" y2="${y + DEP}" stroke="${LINE}" stroke-width="0.75" opacity="0.5"/>`
  );
}

// 8.5" filler/clearance gap at a back-wall corner. Tan so it reads as a gap,
// not a bay, with the dimension labelled inside.
function gapCell(x: number, y: number): string {
  const cx = x + GAP / 2;
  const cy = y + DEP / 2;
  return (
    `<rect x="${x}" y="${y}" width="${GAP}" height="${DEP}" fill="${TAN}" stroke="${LINE}" stroke-width="1.5"/>` +
    `<text x="${cx}" y="${cy}" transform="rotate(-90 ${cx} ${cy})" text-anchor="middle" ` +
    `dominant-baseline="central" font-family="system-ui,sans-serif" font-size="8" font-weight="700" fill="${LINE}">8.5&quot;</text>`
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
    parts.push(cornerPiece(ox, oy));
    parts.push(gapCell(ox + DEP, oy));
    a.forEach((c, i) => parts.push(bayCell(ox + DEP + GAP + i * BAY, oy, BAY, DEP, c)));
    b.forEach((c, j) => parts.push(bayCell(ox, oy + DEP + j * BAY, DEP, BAY, c)));
    parts.push(label('Wall A', ox + DEP + GAP + (na * BAY) / 2, oy - 8));
    parts.push(label('Wall B', ox - 9, oy + DEP + (nb * BAY) / 2, -90));
    const W = ox + DEP + GAP + na * BAY + M;
    const H = oy + DEP + nb * BAY + M;
    return svg(W, H, parts.join(''));
  }

  // u_shaped
  const c = codes('C');
  const nc = Math.max(1, c.length);
  const aStart = ox + DEP + GAP; // back-wall bays start after the left corner + gap
  const rightX = aStart + na * BAY + GAP; // ...then the right gap, then the right corner
  const parts: string[] = [];
  parts.push(cornerPiece(ox, oy));
  parts.push(cornerPiece(rightX, oy));
  parts.push(gapCell(ox + DEP, oy));
  parts.push(gapCell(aStart + na * BAY, oy));
  a.forEach((cc, i) => parts.push(bayCell(aStart + i * BAY, oy, BAY, DEP, cc)));
  b.forEach((cc, j) => parts.push(bayCell(ox, oy + DEP + j * BAY, DEP, BAY, cc)));
  c.forEach((cc, j) => parts.push(bayCell(rightX, oy + DEP + j * BAY, DEP, BAY, cc)));
  parts.push(label('Wall A', aStart + (na * BAY) / 2, oy - 8));
  parts.push(label('Wall B', ox - 9, oy + DEP + (nb * BAY) / 2, -90));
  parts.push(label('Wall C', rightX + DEP + 9, oy + DEP + (nc * BAY) / 2, 90));
  const W = rightX + DEP + PAD_SIDE + M;
  const H = oy + DEP + Math.max(nb, nc) * BAY + M;
  return svg(W, H, parts.join(''));
}
