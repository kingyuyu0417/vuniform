-- Fix public POS write access for the cashier payment flow.
-- This enables the anonymous/public app key to insert/update/select sales records.

-- orders table
 drop policy if exists "Allow order access" on public.orders;
create policy "Allow order access"
on public.orders
for all
to anon
using (true)
with check (true);

-- order_items table
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

-- optional: keep authenticated access as well
create policy if not exists "Authenticated staff can read orders"
on public.orders
for select
to authenticated
using (true);

create policy if not exists "Authenticated staff can write orders"
on public.orders
for insert
to authenticated
with check (true);

create policy if not exists "Authenticated staff can update orders"
on public.orders
for update
to authenticated
using (true)
with check (true);

create policy if not exists "Authenticated staff can read order items"
on public.order_items
for select
to authenticated
using (true);

create policy if not exists "Authenticated staff can write order items"
on public.order_items
for insert
to authenticated
with check (true);

create policy if not exists "Authenticated staff can update order items"
on public.order_items
for update
to authenticated
using (true)
with check (true);
