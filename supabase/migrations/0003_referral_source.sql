-- Capture an optional "How did you hear about us?" response with the order.
alter table public.orders add column if not exists referral_source text;
