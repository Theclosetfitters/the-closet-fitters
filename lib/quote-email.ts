// Builds the written, itemized quote email (HTML) for a checkout.
import type { Catalog, ClosetConfig, PriceBreakdown } from '@/types';
import { formatCents, formatInches } from '@/lib/format';
import { finishedHeightLabel, wallLabel, wallsForShape } from '@/lib/config';
import { birdsEyeLegend, birdsEyeSvg } from '@/lib/birdseye';

export interface QuoteContact {
  name: string;
  phone: string;
  email: string;
  address: string;
  /** Optional referral. Stored with the order; never shown in the email. */
  referralSource?: string;
}

export interface QuoteCloset {
  config: ClosetConfig;
  breakdown: PriceBreakdown;
  /** Inline PNG data URI of the 2D sketch, if available. */
  sketchDataUri?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildQuoteEmailHtml(
  catalog: Catalog,
  contact: QuoteContact,
  closets: QuoteCloset[],
  grandTotalCents: number,
  baseUrl: string = ''
): string {
  const interiorLabel = (id: string) =>
    catalog.interiors.find((i) => i.id === id)?.label ?? id;
  const matLabel = (id: string) =>
    catalog.materials.find((m) => m.id === id)?.label ?? id;
  const colorLabel = (id: string) =>
    catalog.hardware.find((h) => h.id === id)?.label ?? id;
  const shapeLabel = (id: string) =>
    catalog.shapes.find((s) => s.id === id)?.label ?? id;
  const styleLabel = (id: string) =>
    catalog.hardwareStyles.find((s) => s.id === id)?.label ?? id;

  const blocks = closets
    .map((c, idx) => {
      const cfg = c.config;
      const widthIn = cfg.sections.reduce((a, s) => a + s.widthIn, 0);
      const bays = cfg.sections
        .map(
          (s, i) =>
            `<tr><td style="padding:4px 8px;color:#52525b;">Bay ${i + 1}</td>` +
            `<td style="padding:4px 8px;">${esc(interiorLabel(s.interior))}${
              s.hasBack ? ' + back panel' : ''
            }</td>` +
            `<td style="padding:4px 8px;text-align:right;color:#52525b;">${esc(
              formatInches(s.widthIn)
            )}</td></tr>`
        )
        .join('');
      const img = c.sketchDataUri
        ? `<div style="margin:10px 0;"><img src="${c.sketchDataUri}" alt="Closet ${
            idx + 1
          } sketch" style="max-width:100%;border:1px solid #e4e4e7;border-radius:8px;"/></div>`
        : '';

      // Wall breakdown for L / U shapes.
      const walls = wallsForShape(cfg.shape);
      const wallRows =
        walls.length > 1
          ? walls
              .map((w) => {
                const ws = cfg.sections.filter((s) => s.wall === w);
                const desc = ws.length
                  ? ws.map((s) => interiorLabel(s.interior)).join(', ')
                  : '—';
                return `<li><strong>${esc(wallLabel(w))}:</strong> ${ws.length} bay${
                  ws.length === 1 ? '' : 's'
                } — ${esc(desc)}</li>`;
              })
              .join('')
          : '';
      const wallBlock = wallRows
        ? `<ul style="margin:6px 0 8px;padding-left:18px;color:#3f3f46;font-size:13px;">${wallRows}</ul>`
        : '';

      return `
        <div style="margin:18px 0;padding:16px;border:1px solid #e4e4e7;border-radius:10px;">
          <h3 style="margin:0 0 8px;font-size:16px;">Closet ${idx + 1} — ${esc(
        formatCents(c.breakdown.totalCents)
      )}</h3>
          <p style="margin:8px 0 2px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#71717a;">
            Hardware &amp; Finish Details
          </p>
          <table style="font-size:14px;color:#3f3f46;">
            <tr><td style="padding:1px 8px 1px 0;color:#71717a;">Shape</td><td>${esc(shapeLabel(cfg.shape))}</td></tr>
            <tr><td style="padding:1px 8px 1px 0;color:#71717a;">Material</td><td>${esc(matLabel(cfg.materialId))}</td></tr>
            <tr><td style="padding:1px 8px 1px 0;color:#71717a;">Hardware</td><td>${esc(
              styleLabel(cfg.hardwareStyleId)
            )} in ${esc(colorLabel(cfg.hardwareColorId))}</td></tr>
            <tr><td style="padding:1px 8px 1px 0;color:#71717a;">Rod</td><td>${esc(colorLabel(cfg.rodColorId))}</td></tr>
            <tr><td style="padding:1px 8px 1px 0;color:#71717a;">Dimensions</td><td>${esc(
              formatInches(widthIn)
            )} W × ${esc(formatInches(catalog.constraints.depthIn))} D × ${esc(
        finishedHeightLabel(catalog, cfg)
      )} H</td></tr>
            <tr><td style="padding:1px 8px 1px 0;color:#71717a;">Top cap</td><td>Included — 0.75&quot; × 15.5&quot;, 0.5&quot; front overhang, matching finish, spanning full width including corners</td></tr>
          </table>
          ${wallBlock}
          ${img}
          <p style="margin:14px 0 4px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#71717a;">
            Your Closet Layout
          </p>
          <div style="margin:4px 0;">${birdsEyeSvg(catalog, cfg)}</div>
          <p style="margin:4px 0 8px;font-size:12px;color:#71717a;">${birdsEyeLegend(
            catalog
          )
            .map((l) => `${esc(l.code)} = ${esc(l.label)}`)
            .join('&nbsp;&nbsp; ')}</p>
          ${
            cfg.shape === 'straight'
              ? ''
              : `<p style="margin:4px 0 8px;font-size:12px;color:#71717a;">Note: Side wall cabinetry runs flush to the back wall with an 8.5&quot; clearance at each corner for full hanging depth on side walls.</p>`
          }
          <table style="width:100%;border-collapse:collapse;font-size:14px;">${bays}</table>
        </div>`;
    })
    .join('');

  return `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#18181b;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#1f333a;text-align:center;padding:24px;border-radius:10px;margin:0 0 20px;"><img src="${baseUrl}/images/logos/logo-full-transparent.png" alt="The Closet Fitters" style="height:64px;width:auto;display:block;margin:0 auto;" /></div>
      <h1 style="font-size:20px;margin:0 0 4px;">Your custom closet quote</h1>
      <p style="margin:0 0 16px;color:#52525b;">Hi ${esc(
        contact.name
      )}, thanks for your interest! Here is your quote.</p>
      ${blocks}
      <div style="margin-top:8px;padding:14px 16px;border-top:2px solid #18181b;display:flex;justify-content:space-between;">
        <strong style="font-size:16px;">Grand total</strong>
        <strong style="font-size:18px;color:#b45309;">${esc(
          formatCents(grandTotalCents)
        )}</strong>
      </div>
      <p style="margin:16px 0 0;color:#71717a;font-size:13px;">
        Ship to: ${esc(contact.address)}<br/>Phone: ${esc(contact.phone)}
      </p>
      <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;">
        This is an estimate, not a charge. Our team will reach out to confirm details.
      </p>
    </div>
  </body></html>`;
}
