// Client-facing quote PDF (also used verbatim as the sales notification — no
// internal fields). Drawing geometry/ordering comes from lib/closet-geometry so
// the PDF and the cart can't drift. Server-only; never import from a Client
// Component. PDFKit's built-in fonts are WinAnsi and lack eighth-fraction glyphs,
// so dimension text is ASCII-ized in the PDF only (the cart keeps the glyphs).
import path from 'node:path';
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

// The Standard-14 Helvetica AFM carries ¼ ½ ¾ (WinAnsi) but NOT the four eighths
// ⅛ ⅜ ⅝ ⅞, and PDFKit has no subscript digits to compose them from. So ¼ ½ ¾ pass
// straight through as native glyphs (they render *and* extract correctly) and only
// the eighths are drawn as a built fraction: a small numerator over a small
// denominator split by a full-size slash. Route every dimension-bearing string
// through drawDim/measureDim below — never emit ASCII "3/4".
const EIGHTHS: Record<string, [number, number]> = {
  '⅛': [1, 8],
  '⅜': [3, 8],
  '⅝': [5, 8],
  '⅞': [7, 8],
};
type DimTok = { text: string } | { num: number; den: number };
function tokenizeDim(s: string): DimTok[] {
  const out: DimTok[] = [];
  let buf = '';
  for (const ch of s) {
    const f = EIGHTHS[ch];
    if (f) {
      if (buf) {
        out.push({ text: buf });
        buf = '';
      }
      out.push({ num: f[0], den: f[1] });
    } else buf += ch;
  }
  if (buf) out.push({ text: buf });
  return out;
}
// Metrics for one built fraction at the given font/size (also the drawing plan).
function fracMetrics(doc: Doc, num: number, den: number, font: string, size: number) {
  const fs = size * 0.7; // numerator / denominator size
  doc.font(font).fontSize(fs);
  const numW = doc.widthOfString(String(num));
  const denW = doc.widthOfString(String(den));
  doc.fontSize(size);
  const slashW = doc.widthOfString('/');
  const kern = fs * 0.12; // tuck the slash slightly under each digit
  return { fs, numW, denW, slashW, kern, advance: numW - kern + slashW - kern + denW };
}
function measureDim(doc: Doc, s: string, font: string, size: number): number {
  let w = 0;
  for (const tk of tokenizeDim(s)) {
    if ('text' in tk) {
      doc.font(font).fontSize(size);
      w += doc.widthOfString(tk.text);
    } else w += fracMetrics(doc, tk.num, tk.den, font, size).advance;
  }
  return w;
}
// Draw a dimension string at (x, yTop), honouring width+align, with built eighths.
function drawDim(
  doc: Doc,
  s: string,
  x: number,
  yTop: number,
  o: { width?: number; align?: 'left' | 'center' | 'right'; font: string; size: number; color: string }
): number {
  const width = o.width ?? 0;
  const total = measureDim(doc, s, o.font, o.size);
  let cx = x + (o.align === 'center' ? (width - total) / 2 : o.align === 'right' ? width - total : 0);
  for (const tk of tokenizeDim(s)) {
    if ('text' in tk) {
      doc.font(o.font).fontSize(o.size).fillColor(o.color).text(tk.text, cx, yTop, { lineBreak: false });
      cx += doc.widthOfString(tk.text);
    } else {
      const m = fracMetrics(doc, tk.num, tk.den, o.font, o.size);
      doc.fillColor(o.color);
      doc.font(o.font).fontSize(m.fs).text(String(tk.num), cx, yTop, { lineBreak: false });
      const xS = cx + m.numW - m.kern;
      doc.fontSize(o.size).text('/', xS, yTop, { lineBreak: false });
      const xD = xS + m.slashW - m.kern;
      doc.fontSize(m.fs).text(String(tk.den), xD, yTop + (o.size - m.fs), { lineBreak: false });
      cx += m.advance;
    }
  }
  return total;
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
  // Cosmos header bar with the tan rule under it. The hanger lockup already
  // contains the "The Closet Fitters" wordmark and is pre-coloured for dark
  // surfaces (cream text, tan hanger) — draw it as-is, no filter/tint. The bar is
  // tall (158pt) so the stacked wordmark reads at print size.
  const BAR_H = 158;
  const LOGO_W = 173.4; // 120 × 1.4446 (the artwork's aspect ratio)
  const LOGO_H = 120;
  doc.rect(0, 0, PW, BAR_H).fill(COSMOS);
  doc.rect(0, BAR_H, PW, 3).fill(TAN);
  // Resolve from the project root so it works in dev and in the Vercel build; no
  // network fetch — the PDF must render offline.
  const logoPath = path.join(process.cwd(), 'public/images/logos/hanger-lockup.png');
  doc.image(logoPath, (PW - LOGO_W) / 2, (BAR_H - LOGO_H) / 2, { width: LOGO_W, height: LOGO_H });

  // Client / quote blocks sit the same distance below the rule as before: the bar
  // grew by 74pt (84 → 158), so this baseline moves down by 74pt too (102 → 176).
  const topY = 176;
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
  let yInfo = doc.y + 1;
  drawDim(doc, subLine(catalog, cfg), M, yInfo, { width: CW, align: 'left', font: 'Helvetica', size: 9.2, color: MUTED });
  yInfo += 12;
  if (cfg.roomWidthDisplay || cfg.roomLengthDisplay || cfg.roomHeightDisplay) {
    // Labelled W / L / H so two equal dimensions aren't ambiguous.
    const rd = `Room Dimensions: ${cfg.roomWidthDisplay ?? '—'} W × ${cfg.roomLengthDisplay ?? '—'} L × ${
      cfg.roomHeightDisplay ?? '—'
    } H`;
    drawDim(doc, rd, M, yInfo, { width: CW, align: 'left', font: 'Helvetica', size: 9.2, color: MUTED });
    yInfo += 12;
  }
  doc.y = yInfo;

  drawPills(doc, hardwarePills(catalog, cfg), M, doc.y + 6);

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
  let px = x0;
  let py = y0;
  for (const t of pills) {
    const pw = measureDim(doc, t, 'Helvetica', 7.8) + padX * 2;
    if (px + pw > x0 + CW) {
      px = x0;
      py += h + gap;
    }
    doc.roundedRect(px, py, pw, h, h / 2).lineWidth(0.7).fillAndStroke('#FDFBF9', TAN);
    drawDim(doc, t, px + padX, py + (h - 7.8) / 2 + 0.4, { font: 'Helvetica', size: 7.8, color: COSMOS });
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
  drawDim(doc, widthLabel, x, yTop - 10, { width: w, align: 'center', font: 'Helvetica', size: 7, color: STYLE.widthLabel });
  // body + top cap
  doc.lineWidth(STYLE.bodyStrokeW).rect(x, yOf(0), w, bh).fillAndStroke(STYLE.bodyFill, STYLE.bodyStroke);
  doc.lineWidth(STYLE.topCapStrokeW).rect(x, yOf(0), w, TOP_CAP * scale).fillAndStroke(STYLE.topCapFill, STYLE.topCapStroke);

  // The bay code sits at TOP_CAP + 8". Any interior line passing behind it (the SS
  // topmost adjustable shelf lands here; other types can at low scale) is drawn as
  // two segments with a gap centred on the label so nothing crosses the letters.
  const labelY = yOf(TOP_CAP + 8);
  doc.font('Helvetica-Bold').fontSize(7.2);
  const gapHalf = doc.widthOfString(code) / 2 + 4; // label half-width + 4pt padding
  const bandHalf = 6.5; // vertical reach of the label band, in points
  const labelCx = x + w / 2;

  const hline = (yInch: number, color: string, width: number, inset: number, cap: 'butt' | 'round', dash?: [number, number]) => {
    const y = yOf(yInch);
    const x1 = x + inset;
    const x2 = x + w - inset;
    doc.lineWidth(width).lineCap(cap);
    if (dash) doc.dash(dash[0], { space: dash[1] });
    const gL = labelCx - gapHalf;
    const gR = labelCx + gapHalf;
    if (Math.abs(y - labelY) <= bandHalf && gR > x1 && gL < x2) {
      if (gL > x1) doc.moveTo(x1, y).lineTo(gL, y).stroke(color);
      if (gR < x2) doc.moveTo(gR, y).lineTo(x2, y).stroke(color);
    } else {
      doc.moveTo(x1, y).lineTo(x2, y).stroke(color);
    }
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
