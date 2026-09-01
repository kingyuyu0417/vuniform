create table if not exists public.app_storage (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_storage enable row level security;

drop policy if exists "Allow POS app storage access" on public.app_storage;

create policy "Allow POS app storage access"
on public.app_storage
for all
to anon
using (true)
with check (true);

create type public.customer_order_status as enum ('PENDING', 'PREPARING', 'READY', 'COMPLETED', 'SKIPPED');

create table if not exists public.customer_orders (
  id text primary key,
  school_id varchar not null,
  created_at timestamptz not null default now(),
  queue_number varchar not null,
  customer_info jsonb not null default '{}'::jsonb,
  tailor_info jsonb not null default '{}'::jsonb,
  status public.customer_order_status not null default 'PENDING',
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_orders_school_day_queue_unique
  on public.customer_orders (school_id, created_at, queue_number);
create index if not exists customer_orders_school_status_idx on public.customer_orders (school_id, status);
create index if not exists customer_orders_queue_number_idx on public.customer_orders (queue_number);

alter table public.customer_orders enable row level security;

drop policy if exists "Allow customer order access" on public.customer_orders;
create policy "Allow customer order access"
on public.customer_orders
for all
to anon
using (true)
with check (true);

create table if not exists public.guest_visits (
  id text primary key,
  queue_no text not null unique,
  queueNo text,
  guest_name text,
  guestName text,
  class_name text,
  className text,
  height_cm text,
  heightCm text,
  weight_kg text,
  weightKg text,
  phone text,
  notes text default '',
  status text not null default 'waiting',
  school text,
  created_at timestamptz not null default now(),
  createdAt timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists guest_visits_queue_no_idx on public.guest_visits(queue_no);
create index if not exists guest_visits_status_idx on public.guest_visits(status);
create index if not exists guest_visits_school_idx on public.guest_visits(school);

alter table public.guest_visits enable row level security;

drop policy if exists "Allow guest visit access" on public.guest_visits;
create policy "Allow guest visit access"
on public.guest_visits
for all
to anon
using (true)
with check (true);

create table if not exists public.pickup_tickets (
  id text primary key,
  guest_id text,
  guest_name text,
  queue_no text,
  status text not null default 'ready_for_pickup',
  school text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pickup_tickets enable row level security;

drop policy if exists "Allow pickup ticket access" on public.pickup_tickets;
create policy "Allow pickup ticket access"
on public.pickup_tickets
for all
to anon
using (true)
with check (true);

create table if not exists public.pickup_ticket_items (
  id text primary key,
  ticket_id text not null references public.pickup_tickets(id) on delete cascade,
  product_id text,
  product_name text,
  size text,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.pickup_ticket_items enable row level security;

drop policy if exists "Allow pickup ticket item access" on public.pickup_ticket_items;
create policy "Allow pickup ticket item access"
on public.pickup_ticket_items
for all
to anon
using (true)
with check (true);

create table if not exists public.orders (
  id text primary key,
  school text,
  cashier_name text,
  total numeric default 0,
  item_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "Allow order access" on public.orders;
create policy "Allow order access"
on public.orders
for all
to anon
using (true)
with check (true);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  name text,
  size text,
  length text,
  price numeric default 0,
  qty integer default 1,
  created_at timestamptz not null default now()
);

alter table public.order_items enable row level security;

drop policy if exists "Allow order item access" on public.order_items;
create policy "Allow order item access"
on public.order_items
for all
to anon
using (true)
with check (true);