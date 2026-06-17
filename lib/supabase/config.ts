// Helpers to detect whether external services are configured with real keys.
// This lets the app run (configurator, 3D, pricing) with placeholder env values
// while auth/orders/payments stay dormant until real keys are added.

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    !!url &&
    url.startsWith('http') &&
    !!key &&
    !key.startsWith('your-') &&
    !url.includes('placeholder')
  );
}

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && key.startsWith('sk_');
}
