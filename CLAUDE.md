@AGENTS.md

# CLAUDE.md — Project rules

This file is read at the start of every session. Follow these rules in all work on this project.

> Note: this project uses **Next.js 16** (App Router). It has breaking changes vs. older
> versions — see `AGENTS.md` and the bundled guides in `node_modules/next/dist/docs/`
> before writing route/framework code.

## Product

A PWA where customers configure a custom closet (type, dimensions, materials, finishes,
components), see a live 3D render and a live itemized price, then check out and pay.
The company fulfills orders via an internal `/admin` dashboard.

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
