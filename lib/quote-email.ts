// Builds the written, itemized quote email (HTML) for a checkout.
import type { Catalog, ClosetConfig, PriceBreakdown } from '@/types';
import { formatCents, formatInches } from '@/lib/format';

export interface QuoteContact {
  name: string;
  phone: string;
  email: string;
  address: string;
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
  grandTotalCents: number
): string {
  const interiorLabel = (id: string) =>
    catalog.interiors.find((i) => i.id === id)?.label ?? id;
  const matLabel = (id: string) =>
    catalog.materials.find((m) => m.id === id)?.label ?? id;
  const hwLabel = (id: string) =>
    catalog.hardware.find((h) => h.id === id)?.label ?? id;

  const blocks = closets
    .map((c, idx) => {
      const cfg = c.config;
      const heightIn = cfg.heightUpgrade
        ? catalog.constraints.upgradedHeightIn
        : catalog.constraints.standardHeightIn;
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
      return `
        <div style="margin:18px 0;padding:16px;border:1px solid #e4e4e7;border-radius:10px;">
          <h3 style="margin:0 0 8px;font-size:16px;">Closet ${idx + 1} — ${esc(
        formatCents(c.breakdown.totalCents)
      )}</h3>
          <p style="margin:2px 0;color:#3f3f46;">
            <strong>Material:</strong> ${esc(matLabel(cfg.materialId))} ·
            <strong>Hardware:</strong> ${esc(hwLabel(cfg.hardwareId))}
          </p>
          <p style="margin:2px 0 8px;color:#3f3f46;">
            <strong>Dimensions:</strong> ${esc(formatInches(widthIn))} W ×
            ${esc(formatInches(catalog.constraints.depthIn))} D ×
            ${esc(formatInches(heightIn))} H
          </p>
          ${img}
          <table style="width:100%;border-collapse:collapse;font-size:14px;">${bays}</table>
        </div>`;
    })
    .join('');

  return `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#18181b;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
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
