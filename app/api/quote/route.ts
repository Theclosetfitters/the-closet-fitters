// POST /api/quote — the checkout. No payment is taken. Recomputes prices
// server-side (CLAUDE.md #1), emails the customer an itemized quote with a 2D
// sketch of each closet, and records the quote for the team.
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { catalog } from '@/lib/catalog';
import { computePrice } from '@/lib/pricing';
import { drawerBlockedSideBayIds } from '@/lib/config';
import { closetSketchSvg } from '@/lib/sketch';
import { buildQuoteEmailHtml, type QuoteContact } from '@/lib/quote-email';
import { isEmailConfigured, sendQuoteEmail, type EmailAttachment } from '@/lib/email';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createQuoteOrders } from '@/lib/orders';
import type { ClosetConfig, PriceBreakdown } from '@/types';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function quoteRef(): string {
  return `Q-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

export async function POST(request: Request) {
  let body: { contact?: QuoteContact; items?: { config: ClosetConfig }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const contact = body.contact;
  const items = body.items;

  if (
    !contact ||
    !contact.name?.trim() ||
    !contact.phone?.trim() ||
    !contact.address?.trim() ||
    !EMAIL_RE.test(contact.email ?? '')
  ) {
    return NextResponse.json(
      { error: 'Please provide a valid name, phone, email, and address.' },
      { status: 400 }
    );
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
  }

  // Corner rule (one-directional): a side-wall corner bay can't have drawers
  // when the adjacent back-wall corner bay does — they'd collide when opened.
  for (const it of items) {
    const blocked = drawerBlockedSideBayIds(it.config);
    const conflict = it.config.sections.some(
      (s) => blocked.has(s.id) && s.interior === 'drawers'
    );
    if (conflict) {
      return NextResponse.json(
        {
          error:
            'Drawers can’t be on a side wall corner bay when the adjacent back wall corner bay has a drawer bank.',
        },
        { status: 400 }
      );
    }
  }

  // Recompute every closet's price server-side.
  let breakdowns: PriceBreakdown[];
  try {
    breakdowns = items.map((it) => computePrice(catalog, it.config));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid configuration' },
      { status: 400 }
    );
  }

  const closets = items.map((it, i) => ({
    config: it.config,
    breakdown: breakdowns[i],
    totalCents: breakdowns[i].totalCents,
  }));
  const grandTotalCents = closets.reduce((a, c) => a + c.totalCents, 0);
  const currency = breakdowns[0]?.currency ?? 'usd';
  const ref = quoteRef();

  // Render each sketch to a PNG for the email (best effort).
  const attachments: EmailAttachment[] = [];
  const emailClosets = await Promise.all(
    closets.map(async (c, i) => {
      const svg = closetSketchSvg(catalog, c.config);
      let sketchDataUri: string | undefined;
      try {
        const png = await sharp(Buffer.from(svg)).png().toBuffer();
        const b64 = png.toString('base64');
        sketchDataUri = `data:image/png;base64,${b64}`;
        attachments.push({ filename: `closet-${i + 1}.png`, content: b64 });
      } catch {
        // Rasterization unavailable — the written quote still goes out.
      }
      return { config: c.config, breakdown: c.breakdown, sketchDataUri };
    })
  );

  let emailSent = false;
  if (isEmailConfigured()) {
    try {
      const html = buildQuoteEmailHtml(catalog, contact, emailClosets, grandTotalCents);
      await sendQuoteEmail({
        to: contact.email,
        subject: `Your custom closet quote (${ref})`,
        html,
        attachments,
      });
      emailSent = true;
    } catch (err) {
      console.error('quote email failed', err);
    }
  }

  let stored = false;
  if (isSupabaseConfigured()) {
    try {
      const user = await getCurrentUser();
      const service = createServiceRoleClient();
      await createQuoteOrders(service, {
        quoteRef: ref,
        userId: user?.id ?? null,
        contact,
        closets,
      });
      stored = true;
    } catch (err) {
      console.error('quote store failed', err);
    }
  }

  return NextResponse.json({
    ok: true,
    quoteRef: ref,
    grandTotalCents,
    currency,
    closets: closets.map((c) => ({ totalCents: c.totalCents })),
    emailSent,
    stored,
  });
}
