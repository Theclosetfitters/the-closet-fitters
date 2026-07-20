// Server-only: renders a Letter-size PDF whose diagram matches the shopping-cart
// 2D view — per-wall bay columns with rods / shelves / drawer lines, wall labels
// with tan underlines, corner gaps, and a top-cap bar. Never import from a
// Client Component.
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
const KABUL = '#5E4F3E'; // wall labels
const DR_BROWN = '#A0522D'; // drawers bay code
const GRID = '#888888'; // internal shelf/rod/drawer lines
const PANEL = '#F8F4F0'; // diagram container fill

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

// --- Diagram (matches the cart 2D view) ------------------------------------
function drawDiagram(doc: Doc, cfg: ClosetConfig, x0: number, yTop: number, contentW: number) {
  const onWall = (w: WallId) => cfg.sections.filter((s) => s.wall === w);
  let runs: Run[];
  if (cfg.shape === 'l_shaped') {
    runs = [
      { title: 'Wall B — Left', sections: onWall('B') },
      { title: 'Wall A — Back', sections: onWall('A') },
    ];
  } else if (cfg.shape === 'u_shaped') {
    // Left-to-right: Right | Back | Left (matches the cart)
    runs = [
      { title: 'Wall C — Right', sections: onWall('C') },
      { title: 'Wall A — Back', sections: onWall('A') },
      { title: 'Wall B — Left', sections: onWall('B') },
    ];
  } else {
    runs = [{ title: 'Wall A', sections: cfg.sections }];
  }
  runs = runs.filter((r) => r.sections.length > 0);

  const PAD = 16;
  const gapBoxW = 12;
  const nGaps = Math.max(0, runs.length - 1);
  const totalBays = runs.reduce((a, r) => a + r.sections.length, 0) || 1;
  const areaW = contentW - PAD * 2;
  const bayW = Math.max(22, Math.min(52, (areaW - nGaps * gapBoxW) / totalBays));
  const bayH = 72;
  const diagramW = totalBays * bayW + nGaps * gapBoxW;

  // Vertical rhythm inside the container.
  const containerTop = yTop;
  const contentTop = containerTop + PAD;
  const subtitleY = contentTop;
  const wallLabelY = contentTop + 18;
  const underlineY = wallLabelY + 11;
  const widthLabelY = wallLabelY + 19;
  const bayTop = widthLabelY + 10;
  const bayBottom = bayTop + bayH;
  const containerBottom = bayBottom + PAD;

  // Container.
  doc.roundedRect(x0, containerTop, contentW, containerBottom - containerTop, 10).fill(PANEL);

  // Subtitle: "[Shape] · [Material] · [Rod color] rods".
  const subtitle = `${label(catalog.shapes, cfg.shape)} · ${label(catalog.materials, cfg.materialId)} · ${label(
    catalog.hardware,
    cfg.rodColorId
  )} rods`;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(subtitle, x0 + PAD, subtitleY, {
    width: areaW,
    align: 'center',
  });

  const startX = x0 + PAD + Math.max(0, (areaW - diagramW) / 2);

  let cx = startX;
  runs.forEach((run, ri) => {
    const wallW = run.sections.length * bayW;

    // Wall label (uppercase, Kabul) + tan underline.
    const labelW = Math.max(wallW + 40, 100);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(KABUL).text(run.title.toUpperCase(), cx + wallW / 2 - labelW / 2, wallLabelY, {
      width: labelW,
      align: 'center',
      characterSpacing: 1,
      lineBreak: false,
    });
    const ulW = Math.min(wallW + 16, run.title.length * 6 + 14);
    doc
      .lineWidth(1.5)
      .moveTo(cx + wallW / 2 - ulW / 2, underlineY)
      .lineTo(cx + wallW / 2 + ulW / 2, underlineY)
      .stroke(TAN);

    // Bays.
    run.sections.forEach((s, i) => {
      const bx = cx + i * bayW;
      // width above
      doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(formatInches(s.widthIn), bx, widthLabelY, {
        width: bayW,
        align: 'center',
      });
      // bay rectangle
      doc.lineWidth(0.5).rect(bx, bayTop, bayW, bayH).stroke(COSMOS);
      // internal lines
      drawBayInternals(doc, s.interior, bx, bayW, bayTop, bayH);
      // type code, colored, with +B when back panels are on
      const code = codeFor(s.interior);
      const color = code === 'DR' ? DR_BROWN : COSMOS;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(color).text(`${code}${cfg.backPanels ? ' +B' : ''}`, bx, bayTop + 3, {
        width: bayW,
        align: 'center',
      });
    });

    // Top-cap bar at the bottom of the wall (semi-transparent tan).
    doc.save();
    doc.fillOpacity(0.45).rect(cx, bayBottom - 5, wallW, 5).fill(TAN);
    doc.restore();

    cx += wallW;

    // 8.5" corner gap box between walls (L / U).
    if (ri < runs.length - 1) {
      doc.save();
      doc.dash(3, { space: 2 }).lineWidth(1).rect(cx, bayTop, gapBoxW, bayH).stroke(TAN);
      doc.undash();
      doc.restore();
      const rcx = cx + gapBoxW / 2;
      const rcy = bayTop + bayH / 2;
      doc.save();
      doc.rotate(-90, { origin: [rcx, rcy] });
      doc.font('Helvetica').fontSize(6).fillColor(TAN).text('8.5"', rcx - 14, rcy - 3, {
        width: 28,
        align: 'center',
        lineBreak: false,
      });
      doc.restore();
      cx += gapBoxW;
    }
  });

  // Overall dimensions below the container.
  const totalWidthIn = cfg.sections.reduce((a, s) => a + s.widthIn, 0);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    `Overall: ${formatInches(totalWidthIn)} W × ${finishedHeightLabel(catalog, cfg)} H × ${formatInches(
      catalog.constraints.depthIn
    )} D`,
    x0,
    containerBottom + 8,
    { width: contentW, align: 'center' }
  );
  doc.y = containerBottom + 8 + 14;
}

// Horizontal shelf / rod / drawer lines inside a bay, matching the cart style.
function drawBayInternals(doc: Doc, interior: string, bx: number, bayW: number, bayTop: number, bayH: number) {
  const lw = 0.5;
  const span = bayW * 0.8;
  const x0 = bx + (bayW - span) / 2;
  const x1 = x0 + span;
  const cx = bx + bayW / 2;
  const hline = (y: number, dash = false) => {
    if (dash) doc.dash(4, { space: 3 });
    doc.lineWidth(lw).moveTo(x0, y).lineTo(x1, y).stroke(GRID);
    if (dash) doc.undash();
  };

  switch (interior) {
    case 'full_hanging': // FH — one rod
      hline(bayTop + 16);
      break;
    case 'long_hanging': // LH — one rod, higher
      hline(bayTop + 10);
      break;
    case 'double_hanging': // DH — two rods
      hline(bayTop + 14);
      hline(bayTop + 40);
      break;
    case 'adjustable_shelves': { // SH — 5 dashed shelves
      const n = 5;
      for (let i = 1; i <= n; i++) hline(bayTop + (bayH * i) / (n + 1), true);
      break;
    }
    case 'shoe_shelves': { // SS — 6 dashed shelves
      const n = 6;
      for (let i = 1; i <= n; i++) hline(bayTop + (bayH * i) / (n + 1), true);
      break;
    }
    case 'drawers': { // DR — 4 solid dividers + centered pull tick
      const n = 4;
      for (let i = 1; i <= n; i++) {
        const y = bayTop + (bayH * i) / (n + 1);
        hline(y);
        doc.lineWidth(lw).moveTo(cx - 4, y).lineTo(cx + 4, y).stroke(GRID);
      }
      break;
    }
    // Unknown interior → empty rectangle (no internal lines).
  }
}
