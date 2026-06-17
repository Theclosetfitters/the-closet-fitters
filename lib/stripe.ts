// Server-side Stripe client. SERVER ONLY — uses the secret key.
// Keep this out of any Client Component.
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Pin an API version for predictable behavior. Update intentionally.
  apiVersion: '2026-05-27.dahlia',
  typescript: true,
});
