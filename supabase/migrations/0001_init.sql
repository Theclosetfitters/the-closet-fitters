-- Closet configurator — initial schema.
-- Run in the Supabase SQL editor, or via the Supabase CLI:
--   supabase db push
--
-- Tables: profiles (admin role), orders, pending_checkouts.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, holds the admin flag.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- orders: created ONLY by the Stripe webhook (service role), after payment.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users (id) on delete set null,
  config             jsonb not null,
  price_breakdown    jsonb not null,
  total_cents        integer not null,
  currency           text not null default 'usd',
  status             text not null default 'received'
                       check (status in ('received','in_production','ready','completed')),
  stripe_session_id  text unique,
  paid               boolean not null default false,
  customer_email     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

-- helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- Customers can read their own orders.
create policy "orders_select_own"
  on public.orders for select
  using (auth.uid() = user_id);

-- Admins can read every order.
create policy "orders_select_admin"
  on public.orders for select
  using (public.is_admin());

-- Admins can update orders (e.g. advance the status).
create policy "orders_update_admin"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

-- Note: there is intentionally NO insert policy. Orders are inserted by the
-- webhook using the service-role key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- pending_checkouts: configuration stashed between Checkout creation and the
-- webhook. Written/read with the service-role key only — RLS denies all else.
-- ---------------------------------------------------------------------------
create table if not exists public.pending_checkouts (
  session_id       text primary key,
  user_id          uuid references auth.users (id) on delete set null,
  config           jsonb not null,
  price_breakdown  jsonb not null,
  total_cents      integer not null,
  currency         text not null default 'usd',
  email            text,
  created_at       timestamptz not null default now()
);

alter table public.pending_checkouts enable row level security;
-- No policies => no client access. Service role bypasses RLS.
