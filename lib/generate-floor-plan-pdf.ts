// Server-only: renders a Letter-size PDF whose diagram matches the shopping-cart
// 2D view — separated tall bay columns with rods / shelves / drawer lines,
// blue wall labels with tan underlines, and a tan cap bar under each bay. Never
// import from a Client Component.
import PDFDocument from 'pdfkit';
import { catalog } from '@/lib/catalog';
import { computePrice } from '@/lib/pricing';
import { finishedHeightIn, finishedHeightLabel, normalizeConfig, wallsForShape } from '@/lib/config';
import { formatCents, formatInches } from '@/lib/format';
import type { ClosetConfig, WallId } from '@/types';

const COSMOS = '#1F333A';
const TAN = '#C7AC90';
const CREAM = '#EAE0D5';
const MUTED = '#7A6E65';
const INK = '#231F20';

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
  const pageW = doc.page.width;

  // ---- Header (branded Cosmos band) ----------------------------------------
  const shapeLabel = label(catalog.shapes, cfg.shape);
  const dateStr = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date()
  );

  doc.rect(0, 0, pageW, 140).fill(COSMOS);
  doc.fillColor(TAN).font('Helvetica').fontSize(9).text('THE', 0, 68, {
    width: pageW,
    align: 'center',
    characterSpacing: 5,
  });
  doc.fillColor(CREAM).font('Helvetica').fontSize(26).text('ClosetFitters', 0, 92, {
    width: pageW,
    align: 'center',
  });
  doc.rect(0, 140, pageW, 3).fill(TAN);

  // Subtitle below the branded header.
  doc.fillColor(MUTED).font('Helvetica').fontSize(12).text(`Floor Plan — ${shapeLabel} Closet`, left, 165, {
    width: contentW,
    align: 'center',
  });
  doc.moveDown(0.15);
  doc.fillColor(MUTED).fontSize(10).text(`${customerName} · ${dateStr}`, { width: contentW, align: 'center' });
  doc.moveDown(1);

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

// --- Diagram (separated tall columns, matching the cart) -------------------
function drawDiagram(doc: Doc, cfg: ClosetConfig, x0: number, yTop: number, contentW: number) {
  const onWall = (w: WallId) => cfg.sections.filter((s) => s.wall === w);
  let runs: Run[];
  if (cfg.shape === 'l_shaped') {
    runs = [
      { title: 'SIDE WALL', sections: onWall('B') },
      { title: 'BACK WALL', sections: onWall('A') },
    ];
  } else if (cfg.shape === 'u_shaped') {
    // Left-to-right: Right | Back | Left (matches the cart)
    runs = [
      { title: 'RIGHT WALL', sections: onWall('C') },
      { title: 'BACK WALL', sections: onWall('A') },
      { title: 'LEFT WALL', sections: onWall('B') },
    ];
  } else {
    runs = [{ title: 'WALL A', sections: cfg.sections }];
  }
  runs = runs.filter((r) => r.sections.length > 0);

  const GAP = 16;
  const totalBays = runs.reduce((a, r) => a + r.sections.length, 0) || 1;
  const bayW = (contentW - (totalBays - 1) * GAP) / totalBays;

  // All diagram Y coordinates derive from startY (well below the header band +
  // accent line) so header text can never overlap the diagram.
  const startY = Math.max(yTop, 166);
  const titleY = startY;
  const wallLabelY = titleY + 24;
  const underlineY = wallLabelY + 10;
  const measureY = wallLabelY + 16;
  const bayTop = measureY + 14;

  // Tall bays: fill the remaining page height (one row), min 300pt.
  const bayH = Math.max(
    300,
    Math.min(360, doc.page.height - doc.page.margins.bottom - bayTop - 30)
  );
  const bayBottom = bayTop + bayH;

  // Title line.
  const subtitle = `${label(catalog.shapes, cfg.shape)} · ${label(catalog.materials, cfg.materialId)} · ${label(
    catalog.hardware,
    cfg.rodColorId
  )} rods`;
  doc.font('Helvetica').fontSize(11).fillColor('#333333').text(subtitle, x0, titleY, {
    width: contentW,
    align: 'center',
  });

  let idx = 0;
  runs.forEach((run) => {
    const firstX = x0 + idx * (bayW + GAP);
    const lastX = x0 + (idx + run.sections.length - 1) * (bayW + GAP);
    const wallCenter = (firstX + lastX + bayW) / 2;

    // Wall label (blue, bold) + tan underline the width of the text.
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#4A7A9B');
    const tw = doc.widthOfString(run.title);
    doc.text(run.title, wallCenter - 70, wallLabelY, { width: 140, align: 'center', lineBreak: false });
    doc
      .lineWidth(1)
      .moveTo(wallCenter - tw / 2, underlineY)
      .lineTo(wallCenter + tw / 2, underlineY)
      .stroke(TAN);

    run.sections.forEach((s) => {
      const bx = x0 + idx * (bayW + GAP);
      // measurement
      doc.font('Helvetica').fontSize(8).fillColor('#888888').text(formatInches(s.widthIn), bx, measureY, {
        width: bayW,
        align: 'center',
      });
      // bay rectangle (white fill + dark border)
      doc.lineWidth(1).rect(bx, bayTop, bayW, bayH).fillAndStroke('#ffffff', '#333333');
      // internal lines
      drawBayInternals(doc, s.interior, bx, bayW, bayTop, bayH);
      // bay type code, colored, +B when back panels on
      const code = codeFor(s.interior);
      const color = code === 'DR' ? '#A0522D' : '#333333';
      doc.font('Helvetica-Bold').fontSize(9).fillColor(color).text(`${code}${cfg.backPanels ? ' +B' : ''}`, bx, bayTop + 4, {
        width: bayW,
        align: 'center',
      });
      // tan cap bar directly below the bay
      doc.save();
      doc.fillOpacity(0.5).rect(bx, bayBottom, bayW, 5).fill(TAN);
      doc.restore();
      idx++;
    });
  });

  // Overall dimensions, centered below the columns.
  const totalWidthIn = cfg.sections.reduce((a, s) => a + s.widthIn, 0);
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text(
    `Overall: ${formatInches(totalWidthIn)} W × ${finishedHeightLabel(catalog, cfg)} H × ${formatInches(
      catalog.constraints.depthIn
    )} D`,
    x0,
    bayBottom + 15,
    { width: contentW, align: 'center' }
  );
  doc.y = bayBottom + 15 + 16;
}

// Horizontal rod / shelf / drawer lines inside a bay (proportional to bay height).
function drawBayInternals(doc: Doc, interior: string, bx: number, bayW: number, bayTop: number, bayH: number) {
  const cx = bx + bayW / 2;
  // Draw a horizontal line at absolute y, spanning `frac` of the bay width.
  const lineY = (y: number, frac: number, color: string, w: number, dash: boolean) => {
    const half = (bayW * frac) / 2;
    if (dash) doc.dash(4, { space: 3 });
    doc.lineWidth(w).moveTo(cx - half, y).lineTo(cx + half, y).stroke(color);
    if (dash) doc.undash();
  };
  const at = (yFrac: number, frac: number, color: string, w: number, dash = false) =>
    lineY(bayTop + bayH * yFrac, frac, color, w, dash);

  switch (interior) {
    case 'full_hanging': // FH — one rod near top
      at(0.12, 0.9, '#333333', 1.5);
      break;
    case 'long_hanging': // LH — one rod near the very top
      at(0.08, 0.9, '#333333', 1.5);
      break;
    case 'double_hanging': // DH — two rods
      at(0.12, 0.9, '#333333', 1);
      at(0.45, 0.9, '#333333', 1);
      break;
    case 'adjustable_shelves': // SH — 5 evenly spaced dashed shelves 0.15..0.90
      for (let i = 0; i < 5; i++) at(0.15 + (0.9 - 0.15) * (i / 4), 0.85, '#aaaaaa', 1, true);
      break;
    case 'shoe_shelves': {
      // SS — 4 dashed above + solid center + 4 dashed below
      const centerY = bayTop + bayH * 0.43;
      const z1top = bayTop + bayH * 0.1;
      for (let i = 0; i < 4; i++) lineY(z1top + ((centerY - z1top) * (i + 1)) / 5, 0.85, '#aaaaaa', 1, true);
      at(0.43, 0.9, '#555555', 2); // fixed center shelf
      const z2bot = bayTop + bayH * 0.94;
      for (let i = 0; i < 4; i++) lineY(centerY + ((z2bot - centerY) * (i + 1)) / 5, 0.85, '#aaaaaa', 1, true);
      break;
    }
    case 'drawers': {
      // DR — 2 dashed shelves, solid divider, then 4 drawers with pulls
      at(0.12, 0.85, '#aaaaaa', 1, true);
      at(0.22, 0.85, '#aaaaaa', 1, true);
      at(0.32, 0.95, '#444444', 1.5);
      const zoneTop = bayTop + bayH * 0.32;
      const drawerH = (bayH * 0.65) / 4;
      for (let i = 0; i < 3; i++) lineY(zoneTop + drawerH * (i + 1), 0.95, '#444444', 1, false);
      for (let i = 0; i < 4; i++) {
        const y = zoneTop + drawerH * i + drawerH * 0.5;
        doc.lineWidth(2).moveTo(cx - 8, y).lineTo(cx + 8, y).stroke('#444444');
      }
      break;
    }
    // Unknown interior → empty rectangle (no internal lines).
  }
}
