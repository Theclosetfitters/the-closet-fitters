// Consultation-request emails (one to the company, one to the customer), built
// from the same data. Mirrors the order-email style: Cosmos header, clean body.
import type { Catalog, ClosetConfig } from '@/types';
import { formatCents, formatInches } from '@/lib/format';
import { finishedHeightLabel, wallLabel, wallsForShape } from '@/lib/config';

export interface ConsultationContact {
  firstName: string;
  lastName: string;
  address: string;
  email: string;
  phone: string;
  referral?: string;
}

export interface ConsultationCloset {
  config: ClosetConfig;
  totalCents: number;
}

export type ConsultationFlow = 'standalone' | 'checkout';

const COSMOS = '#1f333a';
const CREAM = '#eae0d5';
const TAN = '#c7ac90';
const INK = '#3f3f46';
const MUTED = '#71717a';

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function row(label: string, value: string): string {
  return (
    `<tr><td style="padding:3px 16px 3px 0;color:${MUTED};font-size:13px;white-space:nowrap;vertical-align:top;">${esc(
      label
    )}</td><td style="padding:3px 0;color:${INK};font-size:14px;">${esc(value)}</td></tr>`
  );
}

function contactTable(contact: ConsultationContact): string {
  let rows =
    row('First Name', contact.firstName) +
    row('Last Name', contact.lastName) +
    row('Address', contact.address) +
    row('Email', contact.email) +
    row('Phone', contact.phone);
  if (contact.referral && contact.referral.trim()) {
    rows += row('Referral source', contact.referral.trim());
  }
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0 4px;">${rows}</table>`;
}

function configBlock(
  catalog: Catalog,
  closets: ConsultationCloset[],
  grandTotalCents: number
): string {
  const matLabel = (id: string) => catalog.materials.find((m) => m.id === id)?.label ?? id;
  const colorLabel = (id: string) => catalog.hardware.find((h) => h.id === id)?.label ?? id;
  const shapeLabel = (id: string) => catalog.shapes.find((s) => s.id === id)?.label ?? id;
  const styleLabel = (id: string) => catalog.hardwareStyles.find((s) => s.id === id)?.label ?? id;
  const interiorLabel = (id: string) => catalog.interiors.find((i) => i.id === id)?.label ?? id;

  const blocks = closets
    .map((c, idx) => {
      const cfg = c.config;
      const widthIn = cfg.sections.reduce((a, s) => a + s.widthIn, 0);
      const wallRows = wallsForShape(cfg.shape)
        .map((w) => {
          const bays = cfg.sections.filter((s) => s.wall === w);
          const list = bays.map((b, i) => `Bay ${i + 1}: ${interiorLabel(b.interior)}`).join('; ');
          return `<li style="margin:2px 0;"><strong>${esc(wallLabel(w))}:</strong> ${esc(list)}</li>`;
        })
        .join('');
      return `
        <div style="margin:10px 0;padding:12px 14px;border:1px solid #e5e0d5;border-radius:8px;">
          <div style="font-weight:700;font-size:14px;color:${COSMOS};margin-bottom:6px;">Closet ${
            idx + 1
          } — ${esc(formatCents(c.totalCents))}</div>
          <table style="width:100%;border-collapse:collapse;">
            ${row('Shape', shapeLabel(cfg.shape))}
            ${row(
              'Dimensions',
              `${formatInches(widthIn)} W × ${formatInches(
                catalog.constraints.depthIn
              )} D × ${finishedHeightLabel(catalog, cfg)} H`
            )}
            ${row('Material & finish', matLabel(cfg.materialId))}
            ${row('Hardware', `${styleLabel(cfg.hardwareStyleId)} in ${colorLabel(cfg.hardwareColorId)}`)}
            ${row('Rod color', colorLabel(cfg.rodColorId))}
            ${row('Top cap', 'Included')}
          </table>
          <ul style="margin:8px 0 0;padding-left:18px;color:${INK};font-size:13px;">${wallRows}</ul>
        </div>`;
    })
    .join('');

  return `
    <h3 style="margin:18px 0 4px;font-size:16px;color:${COSMOS};">Closet Configuration</h3>
    ${blocks}
    <table style="width:100%;border-top:1px solid #e5e0d5;margin-top:8px;"><tr>
      <td style="padding-top:8px;font-weight:700;font-size:15px;color:${INK};">Total</td>
      <td style="padding-top:8px;text-align:right;font-weight:700;font-size:16px;color:${COSMOS};">${esc(
        formatCents(grandTotalCents)
      )}</td>
    </tr></table>`;
}

function shell(title: string, inner: string, baseUrl: string): string {
  return `<div style="background:#f6f1ea;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <div style="background:${COSMOS};color:${CREAM};padding:24px;text-align:center;">
        <img src="${baseUrl}/images/logos/logo-full-transparent.png" alt="The Closet Fitters" style="height:64px;width:auto;display:block;margin:0 auto 12px;" />
        <div style="font-size:20px;font-weight:700;">${esc(title)}</div>
      </div>
      <div style="padding:22px 24px;color:${INK};">${inner}</div>
    </div>
  </div>`;
}

/** Email to Sales@ — the consultation request (+ closet config from checkout). */
export function buildCompanyConsultationHtml(
  catalog: Catalog,
  contact: ConsultationContact,
  flow: ConsultationFlow,
  closets: ConsultationCloset[],
  grandTotalCents: number,
  baseUrl: string = ''
): string {
  const config =
    flow === 'checkout' && closets.length ? configBlock(catalog, closets, grandTotalCents) : '';
  return shell(
    'New Consultation Request',
    `<p style="margin:0 0 12px;font-size:14px;">The following client is requesting a free design consultation.</p>
     ${contactTable(contact)}
     ${config}`,
    baseUrl
  );
}

/** Confirmation email back to the customer. */
export function buildCustomerConsultationHtml(
  catalog: Catalog,
  contact: ConsultationContact,
  flow: ConsultationFlow,
  closets: ConsultationCloset[],
  grandTotalCents: number,
  baseUrl: string = ''
): string {
  const config =
    flow === 'checkout' && closets.length
      ? `<p style="margin:14px 0 4px;font-size:14px;">A detailed quote for your custom closet configuration is included below.</p>${configBlock(
          catalog,
          closets,
          grandTotalCents
        )}`
      : '';
  return shell(
    'Your request is on its way.',
    `<p style="margin:0 0 12px;font-size:14px;">Thank you for reaching out to The Closet Fitters. We have received your consultation request and will be in touch shortly to schedule your free design consultation.</p>
     ${contactTable(contact)}
     ${config}
     <p style="margin:18px 0 0;font-size:14px;color:${INK};">The Closet Fitters team<br/>
       (954) 589-3233<br/>
       <a href="mailto:Sales@theclosetfitters.com" style="color:${COSMOS};">Sales@theclosetfitters.com</a>
     </p>`,
    baseUrl
  );
}
