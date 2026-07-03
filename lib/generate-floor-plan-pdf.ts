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

// Hanger logo embedded as a base64 PNG. No runtime filesystem access —
// Vercel serverless functions can't reliably read /public at runtime.
const HANGER_PNG_BASE64 =
  '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';

const COSMOS = '#1F333A';
const TAN = '#C7AC90';
const CREAM = '#EAE0D5';
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
  console.log('[PDF] Generating with new branded header');
  const cfg: ClosetConfig = normalizeConfig(catalog, (extractConfig(closetConfig) ?? {}) as ClosetConfig);

  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageW = doc.page.width;

  // ---- Header (branded Cosmos band + hanger logo) --------------------------
  const shapeLabel = label(catalog.shapes, cfg.shape);
  const dateStr = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date()
  );

  doc.rect(0, 0, pageW, 220).fill(COSMOS);
  // PDFKit can't render SVG — convert the hanger to a PNG buffer (best-effort).
  // Never throw: the PDF must still generate if the logo can't be produced.
  try {
    const png = Buffer.from(HANGER_PNG_BASE64, 'base64');
    doc.image(png, pageW / 2 - 250, -30, { width: 500, height: 500 });
  } catch (err) {
    console.error('hanger logo skipped:', err);
  }
  doc
    .fillColor(TAN)
    .font('Helvetica')
    .fontSize(9)
    .text('THE', 0, 150, { width: pageW, align: 'center', characterSpacing: 5 });
  doc
    .fillColor(CREAM)
    .font('Helvetica')
    .fontSize(26)
    .text('ClosetFitters', 0, 178, { width: pageW, align: 'center' });
  doc.rect(0, 220, pageW, 3).fill(TAN);

  // Subtitle below the branded header.
  doc.fillColor(MUTED).font('Helvetica').fontSize(12).text(`Floor Plan — ${shapeLabel} Closet`, left, 236, {
    width: contentW,
    align: 'center',
  });
  doc.moveDown(0.15);
  doc.fillColor(MUTED).fontSize(10).text(`${customerName} · ${dateStr}`, { width: contentW, align: 'center' });
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
