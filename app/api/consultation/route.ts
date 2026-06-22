// POST /api/consultation — handles both the standalone consultation form and
// the checkout consultation form. Sends two emails (company + customer). The
// checkout flow also includes the recomputed closet configuration/quote.
import { NextResponse } from 'next/server';
import { catalog } from '@/lib/catalog';
import { computePrice } from '@/lib/pricing';
import { isEmailConfigured, sendQuoteEmail } from '@/lib/email';
import {
  buildCompanyConsultationHtml,
  buildCustomerConsultationHtml,
  type ConsultationCloset,
  type ConsultationContact,
  type ConsultationFlow,
} from '@/lib/consultation-email';
import type { ClosetConfig } from '@/types';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COMPANY_EMAIL = 'Sales@theclosetfitters.com';

export async function POST(request: Request) {
  let body: {
    contact?: ConsultationContact;
    flow?: string;
    items?: { config: ClosetConfig }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const contact = body.contact;
  const flow: ConsultationFlow = body.flow === 'checkout' ? 'checkout' : 'standalone';

  if (
    !contact ||
    !contact.firstName?.trim() ||
    !contact.lastName?.trim() ||
    !contact.address?.trim() ||
    !contact.phone?.trim() ||
    !EMAIL_RE.test(contact.email ?? '')
  ) {
    return NextResponse.json(
      { error: 'Please fill in your name, address, email, and phone.' },
      { status: 400 }
    );
  }

  // Checkout flow: recompute every closet's price server-side for the summary.
  let closets: ConsultationCloset[] = [];
  if (flow === 'checkout' && Array.isArray(body.items)) {
    try {
      closets = body.items.map((it) => ({
        config: it.config,
        totalCents: computePrice(catalog, it.config).totalCents,
      }));
    } catch {
      closets = [];
    }
  }
  const grandTotalCents = closets.reduce((a, c) => a + c.totalCents, 0);

  let emailSent = false;
  if (isEmailConfigured()) {
    try {
      const baseUrl = request.headers.get('origin') ?? new URL(request.url).origin;
      await sendQuoteEmail({
        to: COMPANY_EMAIL,
        subject: `New Consultation Request — ${contact.firstName} ${contact.lastName}`,
        html: buildCompanyConsultationHtml(catalog, contact, flow, closets, grandTotalCents, baseUrl),
      });
      await sendQuoteEmail({
        to: contact.email,
        subject: 'Your consultation request has been received — The Closet Fitters',
        html: buildCustomerConsultationHtml(catalog, contact, flow, closets, grandTotalCents, baseUrl),
      });
      emailSent = true;
    } catch (err) {
      console.error('consultation email failed', err);
    }
  }

  return NextResponse.json({ ok: true, emailSent });
}
