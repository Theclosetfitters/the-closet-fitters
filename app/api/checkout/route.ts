// POST /api/checkout — recompute the price server-side, create a Stripe hosted
// Checkout Session, and stash the configuration for the webhook to finalize.
// The client's price is NEVER trusted (CLAUDE.md #1). No order is created here;
// that happens only after the webhook verifies payment (CLAUDE.md #2).
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { catalog } from '@/lib/catalog';
import { computePrice } from '@/lib/pricing';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createPendingCheckout } from '@/lib/checkout';
import { isStripeConfigured, isSupabaseConfigured } from '@/lib/supabase/config';
import type { ClosetConfig } from '@/types';

export async function POST(request: Request) {
  if (!isStripeConfigured() || !isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          'Payments are not configured yet. Add Stripe + Supabase keys to .env.local.',
      },
      { status: 503 }
    );
  }

  let config: ClosetConfig;
  try {
    config = (await request.json()) as ClosetConfig;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Recompute the price from the catalog + config. Source of truth.
  let breakdown;
  try {
    breakdown = computePrice(catalog, config);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid configuration' },
      { status: 400 }
    );
  }

  const closetType = catalog.closetTypes.find(
    (t) => t.id === config.closetTypeId
  );
  const user = await getCurrentUser();
  const origin =
    request.headers.get('origin') ?? new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: breakdown.currency,
            unit_amount: breakdown.totalCents,
            product_data: {
              name: `${closetType?.label ?? 'Custom Closet'}`,
              description: `${config.dimensions.width}×${config.dimensions.height}×${config.dimensions.depth} cm`,
            },
          },
        },
      ],
      customer_email: user?.email,
      client_reference_id: user?.id,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      metadata: { closetTypeId: config.closetTypeId },
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    // Stash the configuration for the webhook to turn into an order.
    const service = createServiceRoleClient();
    await createPendingCheckout(service, {
      sessionId: session.id,
      userId: user?.id ?? null,
      config,
      priceBreakdown: breakdown,
      totalCents: breakdown.totalCents,
      currency: breakdown.currency,
      email: user?.email ?? null,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('checkout error', err);
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 500 }
    );
  }
}
