// End-to-end verification of the checkout -> webhook -> order flow.
//
// Run (dev server must be running on BASE_URL):
//   npm run dev            # in one terminal
//   npm run test:e2e       # in another
//
// What it checks:
//   A. Server-side pricing is correct and ignores any client-sent price.
//   B. The webhook rejects missing/!bad signatures and accepts a validly
//      signed event — and only fulfills *paid* sessions. (No cloud keys needed:
//      signing uses your local STRIPE_WEBHOOK_SECRET.)
//   C. A validly signed *paid* event creates exactly one order (idempotent),
//      with the server-computed total. (Requires real Supabase keys + the
//      migration applied; otherwise skipped with instructions.)
//
// Node loads .env.local via the `--env-file` flag in the npm script.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

// ---- tiny test harness -----------------------------------------------------
let pass = 0;
let fail = 0;
let skip = 0;
const C = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};
function ok(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ${C.g('PASS')} ${name}`);
  } else {
    fail++;
    console.log(`  ${C.r('FAIL')} ${name}${detail ? C.dim(' — ' + detail) : ''}`);
  }
}
function skipped(name, why) {
  skip++;
  console.log(`  ${C.y('SKIP')} ${name} ${C.dim('— ' + why)}`);
}

function supabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return (
    !!url &&
    url.startsWith('http') &&
    !url.includes('placeholder') &&
    !!key &&
    !key.startsWith('your-')
  );
}

// Signed POST to the webhook using the SAME secret the server uses locally.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
function postWebhook(eventObj, { badSig = false, noSig = false } = {}) {
  const payload = JSON.stringify(eventObj);
  const headers = { 'content-type': 'application/json' };
  if (!noSig) {
    headers['stripe-signature'] = badSig
      ? 't=1,v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
      : stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  }
  return fetch(`${BASE_URL}/api/webhook`, { method: 'POST', headers, body: payload });
}

function checkoutEvent(sessionId, { paid }) {
  return {
    id: `evt_e2e_${sessionId}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: paid ? 'paid' : 'unpaid',
        customer_details: { email: 'e2e@example.com' },
      },
    },
  };
}

async function priceFor(config) {
  const res = await fetch(`${BASE_URL}/api/price`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`/api/price -> ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`\nE2E verify against ${C.dim(BASE_URL)}\n`);

  // Server reachable?
  try {
    const res = await fetch(`${BASE_URL}/`, { method: 'GET' });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    console.error(
      C.r('Dev server not reachable at ' + BASE_URL + '. Start it with `npm run dev`.')
    );
    console.error(C.dim(String(err)));
    process.exit(1);
  }

  // === A. Server-side pricing ============================================
  console.log('A. Server-side pricing');
  const config = {
    closetTypeId: 'reach-in',
    dimensions: { width: 200, height: 240, depth: 60 },
    selections: {
      material: ['melamine'], // per_area: 8000 * (2.0*2.4=4.8) = 38400
      finish: ['matte-white'], // 0
      shelves: { 'shelf-standard': 3 }, // 3 * 3500 = 10500
    },
  };
  // base 49900 + 38400 + 0 + 10500 = 98800
  const EXPECTED_TOTAL = 98800;
  const breakdown = await priceFor(config);
  ok(
    'reach-in total is computed server-side correctly',
    breakdown.totalCents === EXPECTED_TOTAL,
    `got ${breakdown.totalCents}, expected ${EXPECTED_TOTAL}`
  );
  ok(
    'per-area material line is correct (8000/m² × 4.8 m²)',
    breakdown.lineItems.some((li) => li.amountCents === 38400)
  );

  // Tamper: client tries to smuggle a price — server must ignore it.
  const tampered = await priceFor({ ...config, totalCents: 1, clientPrice: 1 });
  ok(
    'client-submitted price is ignored (CLAUDE.md #1)',
    tampered.totalCents === EXPECTED_TOTAL,
    `got ${tampered.totalCents}`
  );

  // === B. Webhook signature + paid-guard (no cloud keys needed) ==========
  console.log('\nB. Webhook signature & paid-guard');
  const sessionId = `cs_test_e2e_${Date.now()}`;

  const r1 = await postWebhook(checkoutEvent(sessionId, { paid: false }), { noSig: true });
  ok('missing signature → 400', r1.status === 400, `got ${r1.status}`);

  const r2 = await postWebhook(checkoutEvent(sessionId, { paid: false }), { badSig: true });
  ok('bad signature → 400', r2.status === 400, `got ${r2.status}`);

  if (!WEBHOOK_SECRET || WEBHOOK_SECRET.includes('your-')) {
    skipped('valid signature, unpaid → 200 (no fulfillment)', 'STRIPE_WEBHOOK_SECRET not set');
  } else {
    const r3 = await postWebhook(checkoutEvent(sessionId, { paid: false }));
    ok(
      'valid signature, unpaid session → 200 and not fulfilled',
      r3.status === 200,
      `got ${r3.status}`
    );
  }

  // === C. Full paid flow → order created + idempotent ====================
  console.log('\nC. Paid event → order creation (idempotent)');
  if (!supabaseConfigured()) {
    skipped('paid event creates exactly one order', 'Supabase keys not set');
    skipped('replaying the event is idempotent', 'Supabase keys not set');
    console.log(
      C.dim(
        '\n  To run section C: add real Supabase keys to .env.local, apply\n' +
          '  supabase/migrations/0001_init.sql, set STRIPE_WEBHOOK_SECRET to any\n' +
          '  whsec_… value, restart `npm run dev`, then re-run `npm run test:e2e`.'
      )
    );
  } else if (!WEBHOOK_SECRET || WEBHOOK_SECRET.includes('your-')) {
    skipped('paid event creates exactly one order', 'STRIPE_WEBHOOK_SECRET not set');
    skipped('replaying the event is idempotent', 'STRIPE_WEBHOOK_SECRET not set');
  } else {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    // Seed the pending checkout the way /api/checkout would have.
    const seedErr = (
      await admin.from('pending_checkouts').insert({
        session_id: sessionId,
        user_id: null,
        config,
        price_breakdown: breakdown,
        total_cents: breakdown.totalCents,
        currency: breakdown.currency,
        email: 'e2e@example.com',
      })
    ).error;
    ok('seed pending_checkout', !seedErr, seedErr?.message);

    // Fire the paid webhook.
    const r4 = await postWebhook(checkoutEvent(sessionId, { paid: true }));
    ok('paid webhook → 200', r4.status === 200, `got ${r4.status}`);

    const { data: orders1 } = await admin
      .from('orders')
      .select('*')
      .eq('stripe_session_id', sessionId);
    ok('exactly one order was created', (orders1?.length ?? 0) === 1, `count=${orders1?.length}`);
    ok(
      'order total matches server-computed price',
      orders1?.[0]?.total_cents === EXPECTED_TOTAL,
      `got ${orders1?.[0]?.total_cents}`
    );
    ok('order status is "received"', orders1?.[0]?.status === 'received');
    ok('order marked paid', orders1?.[0]?.paid === true);

    // Replay → must not duplicate.
    await postWebhook(checkoutEvent(sessionId, { paid: true }));
    const { data: orders2 } = await admin
      .from('orders')
      .select('id')
      .eq('stripe_session_id', sessionId);
    ok('replay is idempotent (still one order)', (orders2?.length ?? 0) === 1, `count=${orders2?.length}`);

    // Cleanup.
    await admin.from('orders').delete().eq('stripe_session_id', sessionId);
    await admin.from('pending_checkouts').delete().eq('session_id', sessionId);
    console.log(C.dim('  cleaned up test order + pending checkout'));
  }

  // === summary ===========================================================
  console.log(
    `\n${pass} passed, ${fail} failed, ${skip} skipped\n`
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(C.r('\nE2E run crashed:'), err);
  process.exit(1);
});
