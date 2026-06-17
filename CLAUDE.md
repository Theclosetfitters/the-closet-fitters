@AGENTS.md

# CLAUDE.md — Project rules

This file is read at the start of every session. Follow these rules in all work on this project.

> Note: this project uses **Next.js 16** (App Router). It has breaking changes vs. older
> versions — see `AGENTS.md` and the bundled guides in `node_modules/next/dist/docs/`
> before writing route/framework code.

## Product

A PWA where customers configure a custom closet, see a live 3D render and a live
itemized price, then check out and pay. The company fulfills orders via an internal
`/admin` dashboard.

**Product model:** a closet is a left-to-right row of vertical **sections**. Each
section has one interior (long hanging / double hanging / shoe shelves / adjustable
shelves / drawers) and a width. Pricing: $500/section, $1,500 if drawers, +$200/section
for a back panel, +$50 per linear foot to raise height 7'→8'. Depth fixed 15". Material
color (8 options) + hardware color (3) + height are global. **Imperial units + USD only;**
widths display as fractional inches (e.g. `1' 5 1/2"`), snapped to 1/8". The catalog lives
in `catalog/closet-options.json`. Every bay also has a 2" toe kick (recessed 0.75") and a
fixed shelf 12" down from the top; raising to 8' adds the extra foot **below** that shelf.
Grain runs vertically on vertical parts, horizontally on horizontal parts. Real material
swatch images live in `public/textures/<id>.jpg`.

**Checkout = quote, no payment.** Customers add closets to a **cart** (multiple closets),
then check out by submitting name/phone/email/address. `POST /api/quote` recomputes prices
server-side, generates an itemized written quote + a 2D elevation sketch per closet
(`lib/sketch.ts`), emails it to the customer (Resend, gated by `isEmailConfigured()`), and
records the quote in `orders` (gated by Supabase). No online payment. The old Stripe routes
remain but are unused.

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** (v4, configured via `@tailwindcss/postcss` and CSS — no `tailwind.config.js`)
- **Supabase** — Postgres database + Auth (email/password + Google)
- **React Three Fiber** + `@react-three/drei` for the 3D configurator
- **Stripe** — payments (hosted Checkout)
- **Vercel** — deployment

## Hard rules

1. **All prices are calculated server-side.** Never trust a price submitted from the client.
   The server recomputes the price from the catalog + the submitted configuration
   (`lib/pricing.ts` is the single source of truth).
2. **Always verify Stripe payment via webhook before creating an order** — never on the
   success redirect alone. The redirect is for UX only.
3. **Admin routes under `/admin` must check for the admin role server-side on every request.**
   Do not rely on hiding UI; enforce on the server.
4. **`ClosetViewer` (the 3D viewer) takes configuration as props and is fully controlled** —
   it holds no internal state for selections.
5. **Use Stripe test mode keys** (`sk_test_…`, `pk_test_…`) until explicitly told to switch to live.

## Folder structure

- `/app` — all Next.js routes (App Router)
- `/components` — reusable UI components
- `/components/3d` — all Three.js / R3F components
- `/lib` — database helpers, pricing logic, Stripe helpers
- `/catalog` — JSON seed data for closet options and pricing
- `/types` — TypeScript type definitions

## Secrets

- Real keys live in `.env.local` (gitignored). `.env.example` documents the required vars.
- `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` are server-only — never import them
  into a Client Component or expose them to the browser.
