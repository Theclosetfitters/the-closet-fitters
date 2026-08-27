// SVG renderers for the cart, driven by lib/closet-geometry (the same geometry
// the PDF uses). The cart renders SVG; the PDF renders PDFKit — they share the
// numbers, not the drawing calls.
import type { Catalog, ClosetConfig } from '@/types';
import {
  STYLE,
  TOP_CAP,
  TOE_KICK,
  DRAWER_H,
  bayInterior,
  birdsEyePlan,
  elevationStrip,
} from '@/lib/closet-geometry';

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Front-elevation SVG for one closet (all walls, one strip). */
export function elevationSvg(catalog: Catalog, config: ClosetConfig, maxWidth = 524): string {
  const { scale, H, bayHeight, groups, stripWidth } = elevationStrip(catalog, config, maxWidth);
  const padTop = 30;
  const padX = 6;
  const W = stripWidth + padX * 2;
  const Hpx = padTop + bayHeight + 6;
  const yOf = (inch: number) => padTop + inch * scale;
  const p: string[] = [];

  for (const g of groups) {
    // Wall label + 40%-width tan underline (straight closets have no label).
    if (g.label) {
      const cx = padX + g.x + g.width / 2;
      p.push(
        `<text x="${cx}" y="12" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="8.2" font-weight="700" fill="${STYLE.wallLabel}">${esc(g.label)}</text>`
      );
      const uw = g.width * 0.4;
      p.push(`<line x1="${cx - uw / 2}" y1="16" x2="${cx + uw / 2}" y2="16" stroke="${STYLE.tan}" stroke-width="1"/>`);
    }
    for (const b of g.bays) {
      const x = padX + b.x;
      const w = b.width;
      const gi = bayInterior(catalog, b.section.interior, H);
      // Body + top cap.
      p.push(`<rect x="${x}" y="${yOf(0)}" width="${w}" height="${bayHeight}" fill="${STYLE.bodyFill}" stroke="${STYLE.bodyStroke}" stroke-width="${STYLE.bodyStrokeW}"/>`);
      p.push(`<rect x="${x}" y="${yOf(0)}" width="${w}" height="${TOP_CAP * scale}" fill="${STYLE.topCapFill}" stroke="${STYLE.topCapStroke}" stroke-width="${STYLE.topCapStrokeW}"/>`);
      // Width label above.
      p.push(`<text x="${x + w / 2}" y="26" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="7" fill="${STYLE.widthLabel}">${esc(b.widthLabel)}</text>`);
      // The bay code sits at TOP_CAP + 8". Split any interior line that would pass
      // behind it (the SS topmost adjustable lands here) around a centred gap so the
      // label stays legible — mirrors the PDF renderer.
      const labelY = yOf(TOP_CAP + 8);
      const gapHalf = b.code.length * 2.4 + 4; // ~label half-width + padding
      const bandHalf = 6.5;
      const cxb = x + w / 2;
      const hseg = (yInch: number, inset: number, attrs: string) => {
        const y = yOf(yInch);
        const xa = x + inset;
        const xb = x + w - inset;
        const gL = cxb - gapHalf;
        const gR = cxb + gapHalf;
        if (Math.abs(y - labelY) <= bandHalf && gR > xa && gL < xb) {
          if (gL > xa) p.push(`<line x1="${xa}" y1="${y}" x2="${gL}" y2="${y}" ${attrs}/>`);
          if (gR < xb) p.push(`<line x1="${gR}" y1="${y}" x2="${xb}" y2="${y}" ${attrs}/>`);
        } else {
          p.push(`<line x1="${xa}" y1="${y}" x2="${xb}" y2="${y}" ${attrs}/>`);
        }
      };
      // Fixed shelves + case bottom.
      const fixedAttrs = `stroke="${STYLE.fixedShelf}" stroke-width="${STYLE.fixedShelfW}"`;
      gi.fixedShelves.forEach((yInch) => hseg(yInch, STYLE.fixedShelfInset, fixedAttrs));
      hseg(gi.floor, STYLE.fixedShelfInset, fixedAttrs); // case bottom
      // Adjustable shelves (dotted, round cap).
      const adjAttrs = `stroke="${STYLE.adjShelf}" stroke-width="${STYLE.adjShelfW}" stroke-linecap="round" stroke-dasharray="${STYLE.adjShelfDash.join(' ')}"`;
      for (const yInch of gi.adjShelves) hseg(yInch, STYLE.adjShelfInset, adjAttrs);
      // Rods (thick, round cap).
      const rodAttrs = `stroke="${STYLE.rod}" stroke-width="${STYLE.rodW}" stroke-linecap="round"`;
      for (const yInch of gi.rods) hseg(yInch, STYLE.rodInset, rodAttrs);
      // Toe kick.
      p.push(`<rect x="${x + STYLE.toeKickInset}" y="${yOf(gi.toeKickTop)}" width="${w - STYLE.toeKickInset * 2}" height="${TOE_KICK * scale}" fill="${STYLE.toeKickFill}"/>`);
      // Drawer fronts (full overlay) + pulls.
      for (const top of gi.drawerTops) {
        p.push(`<rect x="${x + STYLE.drawerInset}" y="${yOf(top) + 0.5}" width="${w - STYLE.drawerInset * 2}" height="${DRAWER_H * scale - 1}" fill="${STYLE.drawerFill}" stroke="${STYLE.drawerStroke}" stroke-width="${STYLE.drawerStrokeW}"/>`);
        const py = yOf(top + DRAWER_H / 2);
        const cx = x + w / 2;
        p.push(`<line x1="${cx - STYLE.pullWidthPt / 2}" y1="${py}" x2="${cx + STYLE.pullWidthPt / 2}" y2="${py}" stroke="${STYLE.pull}" stroke-width="${STYLE.pullW}" stroke-linecap="round"/>`);
      }
      // Bay code inside the 12" zone.
      p.push(`<text x="${x + w / 2}" y="${yOf(TOP_CAP + 8) + 2.6}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="7.2" font-weight="700" fill="${STYLE.code}">${esc(b.code)}</text>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hpx}" width="100%" style="max-width:${W}px;height:auto" role="img" aria-label="Closet elevation">${p.join('')}</svg>`;
}

/** Bird's-eye (plan) SVG for one closet. */
export function birdsEyeSvg(catalog: Catalog, config: ClosetConfig): string {
  const plan = birdsEyePlan(catalog, config);
  const padX = 34; // room for the rotated LEFT/RIGHT labels
  const padY = 16; // room for the BACK label
  const W = plan.width + padX * 2;
  const Hpx = plan.height + padY * 2;
  const ox = padX;
  const oy = padY;
  const p: string[] = [];

  for (const c of plan.cells) {
    const x = ox + c.x;
    const y = oy + c.y;
    p.push(`<rect x="${x}" y="${y}" width="${c.w}" height="${c.h}" fill="${STYLE.bodyFill}" stroke="${STYLE.bodyStroke}" stroke-width="1.1"/>`);
    const cx = x + c.w / 2;
    const cy = y + c.h / 2;
    const t = c.rotated ? ` transform="rotate(-90 ${cx} ${cy})"` : '';
    p.push(`<text x="${cx}" y="${cy + 3}"${t} text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="8.2" font-weight="700" fill="${STYLE.bodyStroke}">${esc(c.code)}</text>`);
  }
  for (const l of plan.labels) {
    const x = ox + l.x;
    const y = oy + l.y;
    const t = l.rot ? ` transform="rotate(${l.rot} ${x} ${y})"` : '';
    p.push(`<text x="${x}" y="${y}"${t} text-anchor="middle" dominant-baseline="middle" font-family="Inter,system-ui,sans-serif" font-size="7.6" font-weight="700" fill="${STYLE.wallLabel}">${esc(l.text)}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hpx}" width="100%" style="max-width:${W}px;height:auto" role="img" aria-label="Closet bird's-eye view">${p.join('')}</svg>`;
}
