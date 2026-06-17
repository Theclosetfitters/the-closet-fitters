-- Checkout is now a quote request (no online payment). Orders carry the
-- customer's contact details and a shared quote reference.

alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists customer_address text;
alter table public.orders add column if not exists quote_ref text;

create index if not exists orders_quote_ref_idx on public.orders (quote_ref);
