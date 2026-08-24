// Client-facing quote PDF (also used verbatim as the sales notification — no
// internal fields). Drawing geometry/ordering comes from lib/closet-geometry so
// the PDF and the cart can't drift. Server-only; never import from a Client
// Component. PDFKit's built-in fonts are WinAnsi and lack eighth-fraction glyphs,
// so dimension text is ASCII-ized in the PDF only (the cart keeps the glyphs).
import PDFDocument from 'pdfkit';
import { catalog } from '@/lib/catalog';
import { computePrice } from '@/lib/pricing';
import { normalizeConfig } from '@/lib/config';
import { formatCents } from '@/lib/format';
import type { ClosetConfig } from '@/types';
import {
  STYLE,
  TOP_CAP,
  TOE_KICK,
  DRAWER_H,
  CONTENT_WIDTH,
  bayInterior,
  birdsEyePlan,
  elevationPlan,
  hardwarePills,
  subLine,
  type ElevationPage,
  type ElevationPlan,
} from '@/lib/closet-geometry';

type Doc = InstanceType<typeof PDFDocument>;
export type PdfClient = { name: string; address?: string; phone?: string; email?: string };

const COSMOS = '#1F333A';
const TAN = '#C7AC90';
const MUTED = '#7A6E65';
const M = 44;
const CW = CONTENT_WIDTH; // 524

// Standard-14 fonts don't carry ⅛⅜⅝⅞ — swap unicode fractions to ASCII.
function ascii(s: string): string {
  return s
    .replace(/⅛/g, '1/8')
    .replace(/¼/g, '1/4')
    .replace(/⅜/g, '3/8')
    .replace(/½/g, '1/2')
    .replace(/⅝/g, '5/8')
    .replace(/¾/g, '3/4')
    .replace(/⅞/g, '7/8');
}

function extractConfig(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'config' in raw) return (raw as { config: unknown }).config;
  return raw;
}
const closetLabel = (config: ClosetConfig, i: number) => config.name?.trim() || `Closet ${i + 1}`;
const shapeLabel = (config: ClosetConfig) =>
  catalog.shapes.find((s) => s.id === config.shape)?.label ?? config.shape;

export async function generateFloorPlanPdf(
  cartItems: unknown,
  client: PdfClient | string,
  quoteNumber?: string
): Promise<Buffer> {
  const clientObj: PdfClient = typeof client === 'string' ? { name: client } : client;
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: M, bottom: M, left: M, right: M } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const rawItems = Array.isArray(cartItems) ? cartItems : cartItems == null ? [] : [cartItems];
  const closets: ClosetConfig[] = rawItems
    .map((it) => normalizeConfig(catalog, (extractConfig(it) ?? {}) as ClosetConfig))
    .filter((c) => c.sections.length > 0);

  drawPageOneHeader(doc, clientObj, quoteNumber);

  if (closets.length === 0) {
    doc.moveDown(3);
    doc.font('Helvetica').fontSize(14).fillColor(COSMOS).text('No closet configuration found', M, doc.y, {
      width: CW,
      align: 'center',
    });
    doc.end();
    return done;
  }

  const summaries: { name: string; shape: string; bays: number; priceCents: number }[] = [];

  closets.forEach((cfg, i) => {
    if (i > 0) doc.addPage();
    const startY = i === 0 ? doc.y + 8 : M;
    drawCloset(doc, cfg, i, startY);
    summaries.push({
      name: closetLabel(cfg, i),
      shape: shapeLabel(cfg),
      bays: cfg.sections.length,
      priceCents: computePrice(catalog, cfg).totalCents,
    });
  });

  doc.addPage();
  drawSummary(doc, summaries);

  doc.end();
  return done;
}

// ---- Page-1 header bar + client / quote blocks ---------------------------
function drawPageOneHeader(doc: Doc, client: PdfClient, quoteNumber?: string) {
  const PW = doc.page.width;
  doc.rect(0, 0, PW, 84).fill(COSMOS);
  doc.rect(0, 84, PW, 3).fill(TAN);
  // TODO: replace with /public/images/logos/hanger-lockup.png (~200pt wide) once
  // supplied. PDFKit cannot embed SVG; this transparent PNG does not exist yet.
  doc.font('Times-Bold').fontSize(20).fillColor('#EAE0D5').text('The Closet Fitters', 0, 30, {
    width: PW,
    align: 'center',
  });
  doc.font('Helvetica').fontSize(6).fillColor(TAN).text('[ logo: hanger-lockup.png — TODO ]', 0, 60, {
    width: PW,
    align: 'center',
  });

  const topY = 102;
  // Client block (left).
  doc.font('Times-Bold').fontSize(15).fillColor(COSMOS).text(client.name || '', M, topY, { width: 320 });
  doc.font('Helvetica').fontSize(8.6).fillColor(COSMOS);
  if (client.address) doc.text(client.address, M, doc.y + 1, { width: 300 });
  if (client.phone) doc.text(client.phone, M, doc.y);
  if (client.email) doc.text(client.email, M, doc.y);
  const clientBottom = doc.y;

  // Quote block (right).
  doc.font('Helvetica-Bold').fontSize(9.4).fillColor(COSMOS).text(`Quote ${quoteNumber ?? 'TCF-0000'}`, M, topY, {
    width: CW,
    align: 'right',
  });
  const dateStr = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date()
  );
  doc.font('Helvetica').fontSize(8.4).fillColor(MUTED).text(dateStr, M, topY + 14, { width: CW, align: 'right' });

  doc.y = Math.max(clientBottom, topY + 26) + 8;
}

// ---- One closet ----------------------------------------------------------
function drawCloset(doc: Doc, cfg: ClosetConfig, i: number, startY: number) {
  const plan = elevationPlan(catalog, cfg, CW);
  const name = closetLabel(cfg, i);

  doc.font('Times-Bold').fontSize(23).fillColor(COSMOS).text(name, M, startY, { width: CW });
  doc.font('Helvetica').fontSize(9.2).fillColor(MUTED).text(ascii(subLine(catalog, cfg)), M, doc.y + 1, {
    width: CW,
  });
  if (cfg.roomWidthDisplay || cfg.roomLengthDisplay || cfg.roomHeightDisplay) {
    doc.text(
      ascii(
        `Room Dimensions: ${cfg.roomWidthDisplay ?? '—'} × ${cfg.roomLengthDisplay ?? '—'} × ${
          cfg.roomHeightDisplay ?? '—'
        }`
      )
    );
  }

  drawPills(doc, hardwarePills(catalog, cfg).map(ascii), M, doc.y + 6);

  // ELEVATION
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(TAN).text('ELEVATION', M, doc.y + 8, {
    characterSpacing: 1.5,
  });
  const elevBottom = drawElevationPage(doc, plan.pages[0], plan, doc.y + 4);

  if (plan.split) {
    doc.font('Helvetica').fontSize(8.4).fillColor(MUTED).text(plan.pages[0].continuationNote ?? '', M, elevBottom + 10, {
      width: CW,
    });
    // Page 2 — continuation.
    doc.addPage();
    doc.font('Times-Bold').fontSize(23).fillColor(COSMOS).text(`${name} — continued`, M, M, { width: CW });
    doc.font('Helvetica-Bold').fontSize(7.2).fillColor(TAN).text('ELEVATION', M, doc.y + 6, {
      characterSpacing: 1.5,
    });
    const e2 = drawElevationPage(doc, plan.pages[1], plan, doc.y + 4);
    drawBirdsEyeSection(doc, cfg, e2 + 12);
    drawPriceLine(doc, name, cfg);
  } else {
    drawBirdsEyeSection(doc, cfg, elevBottom + 12);
    drawPriceLine(doc, name, cfg);
  }
}

function drawBirdsEyeSection(doc: Doc, cfg: ClosetConfig, y: number) {
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(TAN).text("BIRD'S EYE VIEW", M, y, { characterSpacing: 1.5 });
  drawBirdsEye(doc, cfg, doc.y + 6);
}

function drawPriceLine(doc: Doc, name: string, cfg: ClosetConfig) {
  const PH = doc.page.height;
  const price = computePrice(catalog, cfg).totalCents;
  const y = PH - M - 26;
  doc.lineWidth(0.5).moveTo(M, y).lineTo(M + CW, y).stroke('#E0D8CE');
  doc.font('Helvetica').fontSize(9.6).fillColor(COSMOS).text(
    `${name} — ${shapeLabel(cfg)}, ${cfg.sections.length} bays`,
    M,
    y + 9,
    { width: CW * 0.62, lineBreak: false }
  );
  doc.font('Times-Roman').fontSize(19).fillColor(COSMOS).text(formatCents(price), M, y + 4, {
    width: CW,
    align: 'right',
    lineBreak: false,
  });
}

// ---- Pills ---------------------------------------------------------------
function drawPills(doc: Doc, pills: string[], x0: number, y0: number) {
  const padX = 9;
  const h = 15;
  const gap = 5;
  doc.font('Helvetica').fontSize(7.8);
  let px = x0;
  let py = y0;
  for (const t of pills) {
    const pw = doc.widthOfString(t) + padX * 2;
    if (px + pw > x0 + CW) {
      px = x0;
      py += h + gap;
    }
    doc.roundedRect(px, py, pw, h, h / 2).lineWidth(0.7).fillAndStroke('#FDFBF9', TAN);
    doc.fillColor(COSMOS).font('Helvetica').fontSize(7.8).text(t, px + padX, py + (h - 7.8) / 2 + 0.4, {
      lineBreak: false,
    });
    px += pw + gap;
  }
  doc.y = py + h;
}

// ---- Elevation (one page's worth of wall groups) -------------------------
function drawElevationPage(doc: Doc, page: ElevationPage, plan: ElevationPlan, y0: number): number {
  const offsetX = M + (CW - page.stripWidth) / 2;
  const labelH = 28;
  const yTop = y0 + labelH;
  const scale = plan.scale;

  for (const g of page.groups) {
    if (g.label) {
      const cx = offsetX + g.x + g.width / 2;
      doc.font('Helvetica-Bold').fontSize(8.2).fillColor(STYLE.wallLabel).text(g.label, offsetX + g.x - 20, y0, {
        width: g.width + 40,
        align: 'center',
        lineBreak: false,
      });
      const uw = g.width * 0.4;
      doc.lineWidth(1).moveTo(cx - uw / 2, y0 + 13).lineTo(cx + uw / 2, y0 + 13).stroke(TAN);
    }
    for (const b of g.bays) {
      drawBay(doc, offsetX + b.x, b.width, yTop, scale, plan.H, b.section.interior, b.code, b.widthLabel);
    }
  }
  return yTop + plan.bayHeight;
}

function drawBay(
  doc: Doc,
  x: number,
  w: number,
  yTop: number,
  scale: number,
  H: number,
  interior: string,
  code: string,
  widthLabel: string
) {
  const gi = bayInterior(catalog, interior, H);
  const yOf = (inch: number) => yTop + inch * scale;
  const bh = H * scale;

  // width label above the bay
  doc.font('Helvetica').fontSize(7).fillColor(STYLE.widthLabel).text(ascii(widthLabel), x, yTop - 10, {
    width: w,
    align: 'center',
    lineBreak: false,
  });
  // body + top cap
  doc.lineWidth(STYLE.bodyStrokeW).rect(x, yOf(0), w, bh).fillAndStroke(STYLE.bodyFill, STYLE.bodyStroke);
  doc.lineWidth(STYLE.topCapStrokeW).rect(x, yOf(0), w, TOP_CAP * scale).fillAndStroke(STYLE.topCapFill, STYLE.topCapStroke);

  const hline = (yInch: number, color: string, width: number, inset: number, cap: 'butt' | 'round', dash?: [number, number]) => {
    doc.lineWidth(width).lineCap(cap);
    if (dash) doc.dash(dash[0], { space: dash[1] });
    doc.moveTo(x + inset, yOf(yInch)).lineTo(x + w - inset, yOf(yInch)).stroke(color);
    if (dash) doc.undash();
    doc.lineCap('butt');
  };

  for (const y of gi.fixedShelves) hline(y, STYLE.fixedShelf, STYLE.fixedShelfW, STYLE.fixedShelfInset, 'butt');
  hline(gi.floor, STYLE.fixedShelf, STYLE.fixedShelfW, STYLE.fixedShelfInset, 'butt'); // case bottom
  for (const y of gi.adjShelves) hline(y, STYLE.adjShelf, STYLE.adjShelfW, STYLE.adjShelfInset, 'round', STYLE.adjShelfDash);
  for (const y of gi.rods) hline(y, STYLE.rod, STYLE.rodW, STYLE.rodInset, 'round');

  // toe kick
  doc.rect(x + STYLE.toeKickInset, yOf(gi.toeKickTop), w - STYLE.toeKickInset * 2, TOE_KICK * scale).fill(STYLE.toeKickFill);

  // drawer fronts (full overlay) + pulls
  for (const top of gi.drawerTops) {
    doc
      .lineWidth(STYLE.drawerStrokeW)
      .rect(x + STYLE.drawerInset, yOf(top) + 0.5, w - STYLE.drawerInset * 2, DRAWER_H * scale - 1)
      .fillAndStroke(STYLE.drawerFill, STYLE.drawerStroke);
    const py = yOf(top + DRAWER_H / 2);
    const cx = x + w / 2;
    doc.lineWidth(STYLE.pullW).lineCap('round').moveTo(cx - STYLE.pullWidthPt / 2, py).lineTo(cx + STYLE.pullWidthPt / 2, py).stroke(STYLE.pull);
    doc.lineCap('butt');
  }

  // bay code inside the 12" zone
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(STYLE.code).text(code, x, yOf(TOP_CAP + 8) - 4, {
    width: w,
    align: 'center',
    lineBreak: false,
  });
}

// ---- Bird's-eye ----------------------------------------------------------
function drawBirdsEye(doc: Doc, cfg: ClosetConfig, y0: number) {
  const plan = birdsEyePlan(catalog, cfg);
  const padX = 34;
  const padY = 16;
  const totalW = plan.width + padX * 2;
  const ox = M + Math.max(0, (CW - totalW) / 2) + padX;
  const oy = y0 + padY;

  for (const c of plan.cells) {
    const x = ox + c.x;
    const y = oy + c.y;
    doc.lineWidth(1.1).rect(x, y, c.w, c.h).fillAndStroke(STYLE.bodyFill, STYLE.bodyStroke);
    const cx = x + c.w / 2;
    const cy = y + c.h / 2;
    doc.font('Helvetica-Bold').fontSize(8.2).fillColor(STYLE.bodyStroke);
    if (c.rotated) {
      doc.save();
      doc.rotate(-90, { origin: [cx, cy] });
      doc.text(c.code, cx - 12, cy - 4, { width: 24, align: 'center', lineBreak: false });
      doc.restore();
    } else {
      doc.text(c.code, x, cy - 4, { width: c.w, align: 'center', lineBreak: false });
    }
  }
  for (const l of plan.labels) {
    const x = ox + l.x;
    const y = oy + l.y;
    doc.font('Helvetica-Bold').fontSize(7.6).fillColor(STYLE.wallLabel);
    if (l.rot) {
      doc.save();
      doc.rotate(l.rot, { origin: [x, y] });
      doc.text(l.text, x - 20, y - 4, { width: 40, align: 'center', lineBreak: false });
      doc.restore();
    } else {
      doc.text(l.text, x - 30, y - 4, { width: 60, align: 'center', lineBreak: false });
    }
  }
  doc.y = oy + plan.height + padY;
}

// ---- Totals page ---------------------------------------------------------
function drawSummary(doc: Doc, rows: { name: string; shape: string; bays: number; priceCents: number }[]) {
  doc.font('Times-Bold').fontSize(21).fillColor(COSMOS).text('Estimate Summary', M, M, { width: CW });
  doc.moveDown(0.5);
  let y = doc.y;
  doc.lineWidth(0.5).moveTo(M, y).lineTo(M + CW, y).stroke('#E0D8CE');
  y += 12;

  for (const r of rows) {
    doc.font('Helvetica').fontSize(10).fillColor(COSMOS).text(`${r.name} — ${r.shape}, ${r.bays} bays`, M, y, {
      width: CW * 0.65,
      lineBreak: false,
    });
    doc.text(formatCents(r.priceCents), M, y, { width: CW, align: 'right', lineBreak: false });
    y += 18;
    doc.lineWidth(0.5).moveTo(M, y - 4).lineTo(M + CW, y - 4).stroke('#EFE9E2');
  }

  y += 4;
  doc.lineWidth(1.6).moveTo(M, y).lineTo(M + CW, y).stroke(COSMOS);
  y += 10;
  const total = rows.reduce((a, r) => a + r.priceCents, 0);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COSMOS).text('TOTAL ESTIMATE', M, y + 12, {
    characterSpacing: 1.5,
    lineBreak: false,
  });
  doc.font('Times-Bold').fontSize(30).fillColor(COSMOS).text(formatCents(total), M, y, {
    width: CW,
    align: 'right',
    lineBreak: false,
  });
}
