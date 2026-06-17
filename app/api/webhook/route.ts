// POST /api/webhook — Stripe webhook. The ONLY place orders are created, and
// only after the signature is verified and the session is paid (CLAUDE.md #2).
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createOrder, orderExistsForSession } from '@/lib/orders';
import { deletePendingCheckout, getPendingCheckout } from '@/lib/checkout';

// Stripe needs the raw body + the Node runtime (not edge).
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 503 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Only fulfill paid sessions.
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ received: true });
    }

    const service = createServiceRoleClient();

    // Idempotency: Stripe may deliver the event more than once.
    if (await orderExistsForSession(service, session.id)) {
      return NextResponse.json({ received: true });
    }

    const pending = await getPendingCheckout(service, session.id);
    if (!pending) {
      console.error('No pending checkout for session', session.id);
      // Acknowledge so Stripe stops retrying; investigate out of band.
      return NextResponse.json({ received: true });
    }

    await createOrder(service, {
      userId: pending.userId,
      config: pending.config,
      priceBreakdown: pending.priceBreakdown,
      totalCents: pending.totalCents,
      currency: pending.currency,
      stripeSessionId: session.id,
      customerEmail: session.customer_details?.email ?? pending.email,
    });

    await deletePendingCheckout(service, session.id);
  }

  return NextResponse.json({ received: true });
}
