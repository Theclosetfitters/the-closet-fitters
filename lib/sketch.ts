// Generates a 2D front-elevation sketch (SVG string) of a closet configuration.
// Pure + dependency-free so it runs on the server (for the quote email, where
// it is rasterized to PNG) and the client (rendered inline on the confirmation).
import type { Catalog, ClosetConfig } from '@/types';
import { formatInches } from '@/lib/format';

const SCALE = 5; // px per inch
const MARGIN_X = 28;
const MARGIN_TOP = 64; // title + bay width labels
const MARGIN_BOTTOM = 56; // overall dimensions
const TOE_IN = 2;
const TOP_CUBBY_IN = 12;

const STROKE = '#3f3f46';
const LIGHT = '#faf9f7';
const ROD = '#52525b';
const LABEL = '#52525b';
const TAN = '#C7AC90'; // wall section titles (cart "by wall" mode only)

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function interiorPieces(
  interior: ClosetConfig['sections'][number]['interior'],
  bx: number,
  w: number,
  regionTopY: number,
  regionBotY: number
): string[] {
  const out: string[] = [];
  const cx = bx + w / 2;
  const inset = 6;
  const x0 = bx + inset;
  const x1 = bx + w - inset;
  const rh = regionBotY - regionTopY;
  const rod = (y: number) =>
    `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${ROD}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="${x0}" cy="${y}" r="2.2" fill="${ROD}"/><circle cx="${x1}" cy="${y}" r="2.2" fill="${ROD}"/>`;
  const hline = (y: number, dash = false) =>
    `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${STROKE}" stroke-width="1.4"${
      dash ? ' stroke-dasharray="4 3"' : ''
    }/>`;

  switch (interior) {
    case 'long_hanging':
      out.push(rod(regionTopY + 10));
      break;
    case 'double_hanging': {
      const mid = regionTopY + rh / 2;
      out.push(rod(regionTopY + 10));
      out.push(hline(mid));
      out.push(rod(mid + 10));
      break;
    }
    case 'shoe_shelves': {
      // 6 angled shelves: fixed center (3rd up) + 2 adjustable below, 3 above.
      const n = 6;
      for (let i = 1; i <= n; i++) {
        const y = regionTopY + (rh * i) / (n + 1);
        out.push(
          `<line x1="${x0}" y1="${y + 4}" x2="${x1}" y2="${y - 4}" stroke="${STROKE}" stroke-width="1.4"/>`
        );
      }
      break;
    }
    case 'adjustable_shelves': {
      // 4 shelves: fixed center (2nd up, drawn solid) + 1 adjustable below
      // (dashed), 2 adjustable above (dashed).
      const n = 4;
      for (let i = 1; i <= n; i++) out.push(hline(regionTopY + (rh * i) / (n + 1), i !== 2));
      break;
    }
    case 'drawers': {
      const drawerPx = 10 * SCALE;
      for (let k = 0; k < 4; k++) {
        const top = regionBotY - drawerPx * (k + 1);
        out.push(
          `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${drawerPx - 2}" fill="none" stroke="${STROKE}" stroke-width="1.4"/>` +
            `<line x1="${cx - 10}" y1="${top + drawerPx / 2}" x2="${cx + 10}" y2="${top + drawerPx / 2}" stroke="${ROD}" stroke-width="2.4" stroke-linecap="round"/>`
        );
      }
      const counterY = regionBotY - drawerPx * 4;
      out.push(`<line x1="${x0}" y1="${counterY}" x2="${x1}" y2="${counterY}" stroke="${STROKE}" stroke-width="2"/>`);
      out.push(hline(counterY - (counterY - regionTopY) / 3, true));
      out.push(hline(counterY - (2 * (counterY - regionTopY)) / 3, true));
      break;
    }
  }
  return out;
}

export function closetSketchSvg(
  catalog: Catalog,
  config: ClosetConfig,
  opts?: { byWall?: boolean }
): string {
  const heightIn = config.heightUpgrade
    ? catalog.constraints.upgradedHeightIn
    : catalog.constraints.standardHeightIn;
  const depthIn = catalog.constraints.depthIn;
  const totalWidthIn = config.sections.reduce((a, s) => a + s.widthIn, 0);

  // Cart-only "by wall" mode: split the bays into a separate boxed run per wall
  // — with a gap (break) between runs and a wall title centred above each run's
  // width labels. Everywhere else the sketch stays a single continuous run.
  const byWall = Boolean(opts?.byWall) && config.shape !== 'straight';
  const GROUP_GAP = 26; // px break between walls
  const onWall = (w: 'A' | 'B' | 'C') => config.sections.filter((s) => s.wall === w);
  let runs: { title?: string; sections: ClosetConfig['sections'] }[];
  if (byWall && config.shape === 'l_shaped') {
    runs = [
      { title: 'Side Wall', sections: onWall('B') },
      { title: 'Back Wall', sections: onWall('A') },
    ];
  } else if (byWall) {
    // u_shaped: right, back, left (left to right)
    runs = [
      { title: 'Right Wall', sections: onWall('C') },
      { title: 'Back Wall', sections: onWall('A') },
      { title: 'Left Wall', sections: onWall('B') },
    ];
  } else {
    runs = [{ sections: config.sections }];
  }
  runs = runs.filter((r) => r.sections.length > 0);

  const drawH = heightIn * SCALE;
  const ox = MARGIN_X;
  const oy = MARGIN_TOP + (byWall ? 12 : 0); // extra headroom for the wall titles
  const bottom = oy + drawH;
  const toeTopY = bottom - TOE_IN * SCALE;
  const fixedShelfY = oy + TOP_CUBBY_IN * SCALE;

  const material =
    catalog.materials.find((m) => m.id === config.materialId)?.label ?? config.materialId;
  const rodColor =
    catalog.hardware.find((h) => h.id === config.rodColorId)?.label ?? config.rodColorId;
  const shape =
    catalog.shapes.find((s) => s.id === config.shape)?.label ?? config.shape;
  const interiorLabel = (id: string) =>
    catalog.interiors.find((i) => i.id === id)?.code ?? id;

  const parts: string[] = [];
  parts.push(
    `<text x="${ox}" y="22" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="${STROKE}">${esc(
      shape
    )} · ${esc(material)} · ${esc(rodColor)} rods</text>`
  );

  // Draw one boxed run of bays starting at startX; returns its pixel width.
  const drawRun = (sections: ClosetConfig['sections'], startX: number): number => {
    const runW = sections.reduce((a, s) => a + s.widthIn, 0) * SCALE;
    parts.push(
      `<rect x="${startX}" y="${oy}" width="${runW}" height="${drawH}" fill="${LIGHT}" stroke="${STROKE}" stroke-width="2"/>`
    );
    let cursor = startX;
    sections.forEach((s, i) => {
      const w = s.widthIn * SCALE;
      const bx = cursor;
      cursor += w;
      if (i < sections.length - 1) {
        parts.push(`<line x1="${cursor}" y1="${oy}" x2="${cursor}" y2="${bottom}" stroke="${STROKE}" stroke-width="2"/>`);
      }
      parts.push(`<line x1="${bx}" y1="${fixedShelfY}" x2="${bx + w}" y2="${fixedShelfY}" stroke="${STROKE}" stroke-width="1.6"/>`);
      parts.push(`<line x1="${bx}" y1="${toeTopY}" x2="${bx + w}" y2="${toeTopY}" stroke="${STROKE}" stroke-width="1.6"/>`);
      parts.push(...interiorPieces(s.interior, bx, w, fixedShelfY, toeTopY));
      parts.push(
        `<text x="${bx + w / 2}" y="${oy - 10}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="${LABEL}">${esc(
          formatInches(s.widthIn)
        )}</text>`
      );
      parts.push(
        `<text x="${bx + w / 2}" y="${oy + 28}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="${LABEL}">${esc(
          interiorLabel(s.interior)
        )}${s.hasBack ? ' +B' : ''}</text>`
      );
    });
    return runW;
  };

  let x = ox;
  runs.forEach((run, idx) => {
    const runW = drawRun(run.sections, x);
    if (run.title) {
      // wall title, centred on the bays and just above the width labels
      parts.push(
        `<text x="${x + runW / 2}" y="${oy - 26}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="10" font-weight="700" letter-spacing="1.5" fill="${TAN}">${esc(
          run.title.toUpperCase()
        )}</text>`
      );
    }
    x += runW + (idx < runs.length - 1 ? GROUP_GAP : 0);
  });
  const contentW = x - ox;

  // Overall dimensions below
  parts.push(
    `<text x="${ox + contentW / 2}" y="${bottom + 26}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="${STROKE}">Overall: ${esc(
      formatInches(totalWidthIn)
    )} W &#215; ${esc(formatInches(heightIn))} H &#215; ${esc(formatInches(depthIn))} D</text>`
  );

  const svgW = contentW + MARGIN_X * 2;
  const svgH = oy + drawH + MARGIN_BOTTOM;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">` +
    `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>` +
    parts.join('') +
    `</svg>`
  );
}
