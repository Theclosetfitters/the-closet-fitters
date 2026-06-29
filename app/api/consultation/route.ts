// POST /api/consultation — handles both the standalone consultation form and
// the checkout consultation form. Sends two emails (company + customer). The
// checkout flow also includes the recomputed closet configuration/quote.
import { NextResponse } from 'next/server';
import { catalog } from '@/lib/catalog';
import { computePrice } from '@/lib/pricing';
import { isEmailConfigured, sendQuoteEmail } from '@/lib/email';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServiceRoleClient } from '@/lib/supabase/server';
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
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ??
        request.headers.get('origin') ??
        new URL(request.url).origin;
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

  // Staff portal: record the submission as a job + its default stages.
  // Best-effort — never blocks the customer response. Uses the service-role
  // client because the submitter is anonymous (RLS would otherwise reject it).
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data: job, error } = await supabase
        .from('jobs')
        .insert({
          customer_first_name: contact.firstName,
          customer_last_name: contact.lastName,
          customer_email: contact.email,
          customer_phone: contact.phone,
          customer_address: contact.address,
          how_heard: contact.referral ?? null,
          closet_config: body.items ?? null,
          status: 'new',
        })
        .select()
        .single();
      if (error) throw error;

      const stages = [
        'deposit_received',
        'cnc_sent',
        'cut_edge_banded',
        'assembled',
        'delivered',
        'installed',
      ];
      await supabase
        .from('job_stages')
        .insert(stages.map((stage) => ({ job_id: job.id, stage, completed: false })));
    } catch (err) {
      console.error('job record failed', err);
    }
  }

  return NextResponse.json({ ok: true, emailSent });
}
