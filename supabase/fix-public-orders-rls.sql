-- Fix public POS write access for the cashier payment flow.
-- This enables the anonymous/public app key to insert/update/select sales records.

alter table public.orders add column if not exists cashier_id uuid;
alter table public.orders add column if not exists cashier_name text;
alter table public.orders add column if not exists outlet_name text;
alter table public.orders add column if not exists outlet_address text;
alter table public.orders add column if not exists outlet_phone text;
alter table public.orders add column if not exists total numeric default 0;
alter table public.orders add column if not exists item_count integer default 0;

-- The public app is anonymous and has no auth user id, so cashier_id must be nullable.
alter table public.orders alter column cashier_id drop not null;

-- If the table was created with a foreign-key constraint to auth.users, remove it for the public anonymous mode.
alter table public.orders drop constraint if exists orders_cashier_id_fkey;

-- orders table RLS
 drop policy if exists "Allow order access" on public.orders;
create policy "Allow order access"
on public.orders
for all
to anon
using (true)
with check (true);

-- order_items table RLS
 drop policy if exists "Allow order item access" on public.order_items;
create policy "Allow order item access"
on public.order_items
for all
to anon
using (true)
with check (true);

-- customer_orders table (used for queue/fitting workflow)
 drop policy if exists "Allow customer order access" on public.customer_orders;
create policy "Allow customer order access"
on public.customer_orders
for all
to anon
using (true)
with check (true);

-- optional authenticated access
 drop policy if exists "Authenticated staff can read orders" on public.orders;
create policy "Authenticated staff can read orders"
on public.orders
for select
to authenticated
using (true);

drop policy if exists "Authenticated staff can write orders" on public.orders;
create policy "Authenticated staff can write orders"
on public.orders
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated staff can update orders" on public.orders;
create policy "Authenticated staff can update orders"
on public.orders
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated staff can read order items" on public.order_items;
create policy "Authenticated staff can read order items"
on public.order_items
for select
to authenticated
using (true);

drop policy if exists "Authenticated staff can write order items" on public.order_items;
create policy "Authenticated staff can write order items"
on public.order_items
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated staff can update order items" on public.order_items;
create policy "Authenticated staff can update order items"
on public.order_items
for update
to authenticated
using (true)
with check (true);
