// Server-only: renders a Letter-size PDF whose diagram matches the shopping-cart
// 2D sketch (lib/sketch.ts) — a front elevation drawn per wall, with the same
// bay internals (rods / shelves / drawer fronts), plus a pill-tag row, top-cap
// bars, 8.5" corner notches, per-bay widths, and overall dimensions. Never
// import from a Client Component.
import PDFDocument from 'pdfkit';
import { catalog } from '@/lib/catalog';
import { computePrice } from '@/lib/pricing';
import { finishedHeightIn, finishedHeightLabel, normalizeConfig, wallsForShape } from '@/lib/config';
import { formatCents, formatInches } from '@/lib/format';
import type { ClosetConfig, WallId } from '@/types';

const COSMOS = '#1F333A';
const TAN = '#C7AC90';
const MUTED = '#7A6E65';
const INK = '#231F20';
const STROKE = '#3f3f46';
const LIGHT = '#faf9f7';
const ROD = '#52525b';

function extractConfig(raw: unknown): unknown {
  if (Array.isArray(raw)) return (raw[0] as { config?: unknown })?.config ?? raw[0];
  if (raw && typeof raw === 'object' && 'config' in raw) return (raw as { config: unknown }).config;
  return raw;
}

const label = (arr: { id: string; label: string }[], id: string) =>
  arr.find((x) => x.id === id)?.label ?? id;
const codeFor = (interior: string) => catalog.interiors.find((i) => i.id === interior)?.code ?? '?';
const interiorLabel = (interior: string) =>
  catalog.interiors.find((i) => i.id === interior)?.label ?? interior;

const WALL_NAMES: Record<string, Record<WallId, string>> = {
  straight: { A: 'Wall A', B: 'Wall B', C: 'Wall C' },
  l_shaped: { A: 'Wall A — Back', B: 'Wall B — Left', C: 'Wall C' },
  u_shaped: { A: 'Wall A — Back', B: 'Wall B — Left', C: 'Wall C — Right' },
};
const wallName = (shape: string, w: WallId) => (WALL_NAMES[shape] ?? WALL_NAMES.straight)[w];

type Doc = InstanceType<typeof PDFDocument>;
type Run = { title: string; sections: ClosetConfig['sections'] };

export async function generateFloorPlanPdf(closetConfig: unknown, customerName: string): Promise<Buffer> {
  const cfg: ClosetConfig = normalizeConfig(catalog, (extractConfig(closetConfig) ?? {}) as ClosetConfig);

  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ---- Header --------------------------------------------------------------
  const shapeLabel = label(catalog.shapes, cfg.shape);
  const dateStr = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date()
  );
  doc.fillColor(COSMOS).font('Helvetica-Bold').fontSize(18).text('The Closet Fitters', left, doc.y, {
    width: contentW,
    align: 'center',
  });
  doc.moveDown(0.3);
  doc.fillColor(MUTED).font('Helvetica').fontSize(12).text(`Floor Plan — ${shapeLabel} Closet`, {
    width: contentW,
    align: 'center',
  });
  doc.moveDown(0.15);
  doc.fillColor(MUTED).fontSize(10).text(`${customerName} · ${dateStr}`, { width: contentW, align: 'center' });
  doc.moveDown(0.5);
  const dividerY = doc.y;
  doc.moveTo(left, dividerY).lineTo(left + contentW, dividerY).lineWidth(1).strokeColor(TAN).stroke();
  doc.moveDown(1);

  // ---- Pill-tag row (matches the cart hardware pills) ----------------------
  const pills = [
    label(catalog.hardwareStyles, cfg.hardwareStyleId),
    label(catalog.hardware, cfg.hardwareColorId),
    `${label(catalog.hardware, cfg.rodColorId)} rod`,
    `Height · ${finishedHeightLabel(catalog, cfg)}`,
  ];
  drawPills(doc, pills, left, doc.y, contentW);
  doc.moveDown(0.6);

  // ---- FLOOR PLAN label ----------------------------------------------------
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TAN).text('FLOOR PLAN', left, doc.y, {
    characterSpacing: 1.5,
  });
  doc.moveDown(0.4);

  // ---- Diagram -------------------------------------------------------------
  drawDiagram(doc, cfg, left, doc.y, contentW);

  // ---- Configuration details ----------------------------------------------
  doc.font('Helvetica').fillColor(INK);
  for (const w of wallsForShape(cfg.shape)) {
    const bays = cfg.sections.filter((s) => s.wall === w);
    if (!bays.length) continue;
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COSMOS).text(wallName(cfg.shape, w), { underline: true });
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    bays.forEach((b, i) => doc.text(`Bay ${i + 1}: ${interiorLabel(b.interior)}`));
  }

  doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COSMOS).text('Hardware', { underline: true });
  doc.font('Helvetica').fontSize(10).fillColor(INK);
  doc.text(
    `Hardware: ${label(catalog.hardwareStyles, cfg.hardwareStyleId)} in ${label(catalog.hardware, cfg.hardwareColorId)}`
  );
  doc.text(`Rod: ${label(catalog.hardware, cfg.rodColorId)}`);
  doc.text(`Height: ${finishedHeightIn(catalog, cfg)}"`);
  doc.text(`Back Panels: ${cfg.backPanels ? 'Yes' : 'No'}`);

  doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COSMOS).text('Pricing', { underline: true });
  doc.font('Helvetica').fontSize(10).fillColor(INK);
  try {
    const price = computePrice(catalog, cfg);
    for (const li of price.lineItems) {
      doc.text(li.label, { continued: true });
      doc.text(formatCents(li.amountCents), { align: 'right' });
    }
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COSMOS);
    doc.text('Total', { continued: true });
    doc.text(formatCents(price.totalCents), { align: 'right' });
  } catch {
    doc.text('Pricing unavailable.');
  }

  doc.end();
  return done;
}

// --- Pills -----------------------------------------------------------------
function drawPills(doc: Doc, pills: string[], x0: number, y0: number, contentW: number) {
  const padX = 12;
  const pillH = 18;
  const gap = 6;
  doc.font('Helvetica').fontSize(9);
  let px = x0;
  let py = y0;
  for (const t of pills) {
    const pw = doc.widthOfString(t) + padX * 2;
    if (px + pw > x0 + contentW) {
      px = x0;
      py += pillH + gap;
    }
    doc.roundedRect(px, py, pw, pillH, pillH / 2).lineWidth(1).fillAndStroke('white', TAN);
    doc.fillColor(COSMOS).font('Helvetica').fontSize(9).text(t, px + padX, py + (pillH - 9) / 2 + 0.5, {
      lineBreak: false,
    });
    px += pw + gap;
  }
  doc.y = py + pillH;
}

// --- Diagram (front elevation, per wall) -----------------------------------
function drawDiagram(doc: Doc, cfg: ClosetConfig, x0: number, yTop: number, contentW: number) {
  const onWall = (w: WallId) => cfg.sections.filter((s) => s.wall === w);
  let runs: Run[];
  if (cfg.shape === 'l_shaped') {
    runs = [
      { title: 'Wall B — Left', sections: onWall('B') },
      { title: 'Wall A — Back', sections: onWall('A') },
    ];
  } else if (cfg.shape === 'u_shaped') {
    // left-to-right: Right | Back | Left (matches the cart)
    runs = [
      { title: 'Wall C — Right', sections: onWall('C') },
      { title: 'Wall A — Back', sections: onWall('A') },
      { title: 'Wall B — Left', sections: onWall('B') },
    ];
  } else {
    runs = [{ title: 'Wall A', sections: cfg.sections }];
  }
  runs = runs.filter((r) => r.sections.length > 0);

  const SCALE = 5; // sketch px per inch (before fit-scale)
  const heightIn = finishedHeightIn(catalog, cfg) - catalog.constraints.topCapIn; // base cabinet height
  const drawHpx = heightIn * SCALE;
  const gapPx = 30;
  const runWpx = (r: Run) => r.sections.reduce((a, s) => a + s.widthIn, 0) * SCALE;
  const totalWpx = runs.reduce((a, r) => a + runWpx(r), 0) + gapPx * (runs.length - 1);
  const maxDiagH = 240;
  const k = Math.min(contentW / totalWpx, maxDiagH / drawHpx, 1.4);

  const drawH = drawHpx * k;
  const gap = Math.max(24, gapPx * k);
  const runW = runs.map((r) => runWpx(r) * k);
  const totalW = runW.reduce((a, b) => a + b, 0) + gap * (runs.length - 1);
  const startX = x0 + Math.max(0, (contentW - totalW) / 2);

  const capBar = Math.max(4, 6 * k);
  const titleH = 12;
  const widthLblH = 10;
  const boxTop = yTop + titleH + widthLblH + capBar;
  const boxBottom = boxTop + drawH;
  const fixedShelfY = boxTop + 12 * SCALE * k; // 12" fixed shelf
  const toeTopY = boxBottom - 2 * SCALE * k; // 2" toe kick

  let cx = startX;
  runs.forEach((run, ri) => {
    const rw = runW[ri];

    // Top-cap bar across the wall
    doc.rect(cx, boxTop - capBar, rw, capBar).fill(TAN);
    // Run box fill
    doc.rect(cx, boxTop, rw, drawH).fill(LIGHT);

    let bx = cx;
    run.sections.forEach((s, i) => {
      const w = s.widthIn * SCALE * k;
      const ssFull = s.interior === 'shoe_shelves';
      // fixed shelf (not on shoe section) + toe kick
      if (!ssFull) line(doc, bx, fixedShelfY, bx + w, fixedShelfY, STROKE, Math.max(0.8, 1.6 * k));
      line(doc, bx, toeTopY, bx + w, toeTopY, STROKE, Math.max(0.8, 1.6 * k));
      drawInterior(doc, s.interior, bx, w, ssFull ? boxTop : fixedShelfY, toeTopY, k);
      // bay divider
      if (i < run.sections.length - 1)
        line(doc, bx + w, boxTop, bx + w, boxBottom, STROKE, Math.max(0.8, 2 * k));
      // per-bay width above
      doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(formatInches(s.widthIn), bx, boxTop - capBar - widthLblH, {
        width: w,
        align: 'center',
      });
      // colored bay code near top
      const code = codeFor(s.interior);
      const color = code === 'DR' ? '#5E4F3E' : code === 'LH' ? '#2D4FA8' : COSMOS;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(color).text(`${code}${cfg.backPanels ? ' +B' : ''}`, bx, boxTop + 5, {
        width: w,
        align: 'center',
      });
      bx += w;
    });

    // run border (crisp, on top of internals)
    doc.lineWidth(Math.max(1, 2 * k)).rect(cx, boxTop, rw, drawH).stroke(STROKE);
    // wall title
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COSMOS).text(run.title, cx - 20, yTop, {
      width: rw + 40,
      align: 'center',
    });

    // 8.5" corner notch between walls (L / U)
    if (ri < runs.length - 1) {
      const nx = cx + rw;
      const nw = gap * 0.6;
      const nX = nx + (gap - nw) / 2;
      const nh = drawH * 0.5;
      const nY = boxTop + (drawH - nh) / 2;
      doc.save();
      doc.dash(3, { space: 2 }).lineWidth(0.75).rect(nX, nY, nw, nh).stroke(MUTED);
      doc.undash();
      doc.restore();
      doc.font('Helvetica').fontSize(6).fillColor(MUTED).text('8.5"', nx, nY - 8, { width: gap, align: 'center' });
    }

    cx += rw + gap;
  });

  // Overall dimensions below the diagram
  const totalWidthIn = cfg.sections.reduce((a, s) => a + s.widthIn, 0);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    `Overall: ${formatInches(totalWidthIn)} W × ${finishedHeightLabel(catalog, cfg)} H × ${formatInches(
      catalog.constraints.depthIn
    )} D`,
    x0,
    boxBottom + 8,
    { width: contentW, align: 'center' }
  );
  doc.y = boxBottom + 8 + 14;
}

function line(doc: Doc, x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  doc.lineWidth(width).moveTo(x1, y1).lineTo(x2, y2).stroke(color);
}

// Ported from lib/sketch.ts interiorPieces — bx/w/topY/botY in PDF points.
function drawInterior(
  doc: Doc,
  interior: string,
  bx: number,
  w: number,
  topY: number,
  botY: number,
  k: number
) {
  const inset = 6 * k;
  const x0 = bx + inset;
  const x1 = bx + w - inset;
  const cx = bx + w / 2;
  const rh = botY - topY;
  const rodW = Math.max(1.3, 3 * k);
  const lineW = Math.max(0.6, 1.4 * k);
  const dot = Math.max(1, 2.2 * k);

  const rod = (y: number) => {
    doc.lineWidth(rodW).moveTo(x0, y).lineTo(x1, y).stroke(ROD);
    doc.circle(x0, y, dot).fill(ROD);
    doc.circle(x1, y, dot).fill(ROD);
  };
  const hline = (y: number, dash = false) => {
    if (dash) doc.dash(4 * k, { space: 3 * k });
    doc.lineWidth(lineW).moveTo(x0, y).lineTo(x1, y).stroke(STROKE);
    if (dash) doc.undash();
  };

  switch (interior) {
    case 'long_hanging':
      rod(topY + 10 * k);
      break;
    case 'double_hanging': {
      const mid = topY + rh / 2;
      rod(topY + 10 * k);
      hline(mid);
      rod(mid + 10 * k);
      break;
    }
    case 'full_hanging': {
      rod(topY + 10 * k);
      const fixedY = topY + rh * 0.55;
      hline(fixedY);
      const lower = botY - fixedY;
      hline(fixedY + lower / 3, true);
      hline(fixedY + (2 * lower) / 3, true);
      break;
    }
    case 'shoe_shelves': {
      for (let i = 1; i <= 9; i++) {
        const y = topY + (rh * i) / 10;
        if (i === 5) line(doc, x0, y, x1, y, STROKE, Math.max(1, 2.6 * k));
        else hline(y, true);
      }
      break;
    }
    case 'adjustable_shelves': {
      const n = 4;
      for (let i = 1; i <= n; i++) hline(topY + (rh * i) / (n + 1), i !== 2);
      break;
    }
    case 'drawers': {
      const dpx = 10 * 5 * k; // 10" drawers at SCALE 5
      for (let d = 0; d < 4; d++) {
        const top = botY - dpx * (d + 1);
        doc.lineWidth(lineW).rect(bx, top, w, dpx - 2 * k).stroke(STROKE);
        doc.lineWidth(Math.max(1, 2.4 * k)).moveTo(cx - 10 * k, top + dpx / 2).lineTo(cx + 10 * k, top + dpx / 2).stroke(ROD);
      }
      const counterY = botY - dpx * 4;
      line(doc, x0, counterY, x1, counterY, STROKE, Math.max(1, 2 * k));
      hline(counterY - (counterY - topY) / 3, true);
      hline(counterY - (2 * (counterY - topY)) / 3, true);
      break;
    }
  }
}
