// Server-only: renders a Letter-size PDF of the closet's top-down (bird's-eye)
// floor plan + full configuration/pricing, using PDFKit. Mirrors the geometry
// of lib/birdseye.ts. Never import from a Client Component.
import PDFDocument from 'pdfkit';
import { catalog } from '@/lib/catalog';
import { computePrice } from '@/lib/pricing';
import {
  finishedHeightIn,
  normalizeConfig,
  wallsForShape,
} from '@/lib/config';
import { formatCents } from '@/lib/format';
import type { ClosetConfig, WallId } from '@/types';

const COSMOS = '#1F333A';
const TAN = '#C7AC90';
const MUTED = '#7A6E65';
const INK = '#231F20';

// The closet_config JSONB can be an array of cart items, a single { config },
// or a raw config. Pull out the first config either way.
function extractConfig(raw: unknown): unknown {
  if (Array.isArray(raw)) return (raw[0] as { config?: unknown })?.config ?? raw[0];
  if (raw && typeof raw === 'object' && 'config' in raw) return (raw as { config: unknown }).config;
  return raw;
}

const label = (arr: { id: string; label: string }[], id: string) =>
  arr.find((x) => x.id === id)?.label ?? id;
const codeFor = (interior: string) =>
  catalog.interiors.find((i) => i.id === interior)?.code ?? '?';
const interiorLabel = (interior: string) =>
  catalog.interiors.find((i) => i.id === interior)?.label ?? interior;

const WALL_NAMES: Record<string, Record<WallId, string>> = {
  straight: { A: 'Wall A', B: 'Wall B', C: 'Wall C' },
  l_shaped: { A: 'Wall A — Back', B: 'Wall B — Left', C: 'Wall C' },
  u_shaped: { A: 'Wall A — Back', B: 'Wall B — Left', C: 'Wall C — Right' },
};
const wallName = (shape: string, w: WallId) =>
  (WALL_NAMES[shape] ?? WALL_NAMES.straight)[w];

export async function generateFloorPlanPdf(
  closetConfig: unknown,
  customerName: string
): Promise<Buffer> {
  const cfg: ClosetConfig = normalizeConfig(catalog, (extractConfig(closetConfig) ?? {}) as ClosetConfig);

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
  });
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

  // ---- Floor plan diagram --------------------------------------------------
  drawDiagram(doc, cfg, left, doc.y, contentW);

  // ---- Configuration details ----------------------------------------------
  doc.font('Helvetica').fillColor(INK);
  for (const w of wallsForShape(cfg.shape)) {
    const bays = cfg.sections.filter((s) => s.wall === w);
    if (!bays.length) continue;
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COSMOS).text(wallName(cfg.shape, w), { underline: true });
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    bays.forEach((b, i) => {
      doc.text(`Bay ${i + 1}: ${interiorLabel(b.interior)}`);
    });
  }

  // Hardware
  doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COSMOS).text('Hardware', { underline: true });
  doc.font('Helvetica').fontSize(10).fillColor(INK);
  doc.text(
    `Hardware: ${label(catalog.hardwareStyles, cfg.hardwareStyleId)} in ${label(catalog.hardware, cfg.hardwareColorId)}`
  );
  doc.text(`Rod: ${label(catalog.hardware, cfg.rodColorId)}`);
  doc.text(`Height: ${finishedHeightIn(catalog, cfg)}"`);
  doc.text(`Back Panels: ${cfg.backPanels ? 'Yes' : 'No'}`);

  // Pricing
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

// --- Diagram --------------------------------------------------------------
type Doc = InstanceType<typeof PDFDocument>;

function drawDiagram(doc: Doc, cfg: ClosetConfig, x0: number, y0: number, contentW: number) {
  const codes = (w: WallId) => cfg.sections.filter((s) => s.wall === w).map((s) => codeFor(s.interior));
  const a = codes('A');
  const b = codes('B');
  const c = codes('C');
  const na = Math.max(1, a.length);
  const nb = Math.max(1, b.length);
  const nc = Math.max(1, c.length);

  // Base units (pre-scale).
  const BAY = 54;
  const DEP = 40;
  const GAP = 22;
  const PAD_TOP = 16; // room for wall labels above runs
  const PAD_BOTTOM = 4;

  let natW: number;
  let natH: number;
  if (cfg.shape === 'straight') {
    natW = na * BAY;
    natH = DEP;
  } else if (cfg.shape === 'l_shaped') {
    natW = DEP + GAP + na * BAY;
    natH = Math.max(DEP, nb * BAY);
  } else {
    natW = DEP + GAP + na * BAY + GAP + DEP;
    natH = Math.max(DEP, nb * BAY, nc * BAY);
  }

  const maxDiagH = 250;
  const scale = Math.min(contentW / natW, maxDiagH / (natH + PAD_TOP + PAD_BOTTOM), 1.4);
  const bay = BAY * scale;
  const dep = DEP * scale;
  const gap = GAP * scale;
  const padTop = PAD_TOP * scale;
  const drawW = natW * scale;
  const ox = x0 + (contentW - drawW) / 2; // center horizontally
  const oy = y0 + padTop;

  const CAP = 6;
  const drawBay = (x: number, y: number, w: number, h: number, code: string) => {
    doc.lineWidth(1).rect(x, y, w, h).strokeColor(COSMOS).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COSMOS).text(code, x, y + h / 2 - 4, {
      width: w,
      align: 'center',
    });
  };
  const capH = (x: number, y: number, w: number) => doc.rect(x, y - CAP, w, CAP).fill(TAN);
  const capVLeft = (x: number, y: number, h: number) => doc.rect(x - CAP, y, CAP, h).fill(TAN);
  const capVRight = (x: number, y: number, h: number) => doc.rect(x, y, CAP, h).fill(TAN);
  const wallLbl = (text: string, cx: number, y: number) => {
    doc.font('Helvetica').fontSize(9).fillColor(COSMOS).text(text, cx - 60, y, { width: 120, align: 'center' });
  };
  const notch = (x: number, y: number, w: number, h: number) => {
    doc.save();
    doc.lineWidth(0.75).dash(2, { space: 2 }).rect(x, y, w, h).strokeColor(MUTED).stroke();
    doc.undash();
    doc.font('Helvetica').fontSize(6).fillColor(MUTED).text('8.5"', x - 6, y + h / 2 - 3, {
      width: w + 12,
      align: 'center',
    });
    doc.restore();
  };

  if (cfg.shape === 'straight') {
    capH(ox, oy, na * bay);
    a.forEach((code, i) => drawBay(ox + i * bay, oy, bay, dep, code));
    wallLbl('Wall A', ox + (na * bay) / 2, oy - padTop);
    doc.y = oy + dep + 10;
    return;
  }

  if (cfg.shape === 'l_shaped') {
    const aStartX = ox + dep + gap;
    capH(aStartX, oy, na * bay);
    capVLeft(ox, oy, nb * bay);
    b.forEach((code, j) => drawBay(ox, oy + j * bay, dep, bay, code));
    a.forEach((code, i) => drawBay(aStartX + i * bay, oy, bay, dep, code));
    notch(ox + dep, oy, gap, dep);
    wallLbl('Wall A — Back', aStartX + (na * bay) / 2, oy - padTop);
    wallLbl('Wall B — Left', ox + dep / 2, oy - padTop);
    doc.y = oy + Math.max(dep, nb * bay) + 10;
    return;
  }

  // u_shaped
  const aStartX = ox + dep + gap;
  const aEndX = aStartX + na * bay;
  const cStartX = aEndX + gap;
  capH(aStartX, oy, na * bay);
  capVLeft(ox, oy, nb * bay);
  capVRight(cStartX + dep, oy, nc * bay);
  b.forEach((code, j) => drawBay(ox, oy + j * bay, dep, bay, code));
  c.forEach((code, j) => drawBay(cStartX, oy + j * bay, dep, bay, code));
  a.forEach((code, i) => drawBay(aStartX + i * bay, oy, bay, dep, code));
  notch(ox + dep, oy, gap, dep);
  notch(aEndX, oy, gap, dep);
  wallLbl('Wall A — Back', aStartX + (na * bay) / 2, oy - padTop);
  wallLbl('Wall B — Left', ox + dep / 2, oy - padTop);
  wallLbl('Wall C — Right', cStartX + dep / 2, oy - padTop);
  doc.y = oy + Math.max(dep, nb * bay, nc * bay) + 10;
}
