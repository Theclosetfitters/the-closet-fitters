# The Closet Fitters — configurator PWA

Design a custom closet with a live 3D preview and instant server-side pricing,
then check out and pay. Internal `/admin` dashboard moves orders through
production. Installable as a PWA.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase
(Postgres + Auth) · React Three Fiber · Stripe · Vercel.

See [`CLAUDE.md`](./CLAUDE.md) for the project rules (server-side pricing,
webhook-verified orders, server-side admin checks, etc.).

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The configurator, live 3D preview, and live pricing work immediately with the
placeholder keys in `.env.local`. Auth, payments, and order history stay
dormant (graceful 503 / redirects) until real keys are added — see below.

## Configuration

Copy the keys into `.env.local` (already gitignored; `.env.example` is the
template):

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (server-only) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (`sk_test_…`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys (`pk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` output (`whsec_…`) |

Then apply the database schema: open the Supabase SQL editor and run
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
(creates `profiles`, `orders`, `pending_checkouts` + RLS). To make yourself an
admin: `update profiles set is_admin = true where email = 'you@example.com';`

For Google sign-in, enable the Google provider in Supabase → Authentication.

## Verification

Three layers, runnable locally:

```bash
npm run build      # full production build
npm run test:e2e   # pricing + Stripe webhook signature / paid-guard
npm run test:ui    # configurator + 3D + live pricing in headless Chromium
```

`npm run test:ui` needs the browser once: `npx playwright install chromium`.
Both test scripts expect `npm run dev` running in another terminal.

### Lighting up the full checkout E2E (section C)

`npm run test:e2e` runs 6 checks today; 2 more (paid event → exactly one order,
idempotent replay) skip until a real database is present. To run them:

1. Create a Supabase project and apply the migration (above).
2. Put the Supabase URL + anon + **service-role** keys in `.env.local`.
3. Set `STRIPE_WEBHOOK_SECRET` to any `whsec_…` value (these checks sign their
   own events locally — no Stripe account required).
4. Restart `npm run dev`, then `npm run test:e2e` → 8/8.

### A live guest checkout

1. Add real Stripe **test** keys (`sk_test_…`, `pk_test_…`).
2. Forward webhooks: `stripe listen --forward-to localhost:3000/api/webhook`
   and copy its `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
3. Configure a closet → Checkout → pay with test card `4242 4242 4242 4242`
   (any future expiry / CVC). The webhook creates the order; view it under
   `/account` (or `/admin`).

## Project layout

```
app/                 routes (configurator, checkout, auth, account, admin, api)
components/           UI components
components/3d/        React Three Fiber (ClosetViewer — controlled via props)
lib/                  pricing (server-side source of truth), supabase, stripe, orders
catalog/             closet option + pricing seed data
types/               domain types
supabase/migrations/ SQL schema
scripts/             icon generation + E2E/UI verification harnesses
proxy.ts             Supabase session refresh (Next.js 16's renamed middleware)
```

## Deploy

Deploy on Vercel. Set the same environment variables in the Vercel project, and
add a Stripe webhook endpoint pointing at `https://<your-domain>/api/webhook`
(event `checkout.session.completed`); use that endpoint's signing secret as
`STRIPE_WEBHOOK_SECRET`.
