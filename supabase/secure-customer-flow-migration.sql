-- Customer-flow privacy hardening.
-- Prerequisite: run secure-migration.sql and set VITE_USE_SUPABASE_AUTH=true
-- before applying this migration. Staff access is then authenticated; public
-- pages use only the sanitized RPCs defined below.

begin;

-- Remove the development-only anonymous full-access policies.
drop policy if exists "Allow customer order access" on public.customer_orders;
drop policy if exists "Allow queue counter access" on public.queue_counters;
drop policy if exists "Allow guest visit access" on public.guest_visits;
drop policy if exists "Allow pickup ticket access" on public.pickup_tickets;
drop policy if exists "Allow pickup ticket item access" on public.pickup_ticket_items;
drop policy if exists "Allow order access" on public.orders;
drop policy if exists "Allow order item access" on public.order_items;

revoke all on public.customer_orders, public.queue_counters, public.guest_visits,
  public.pickup_tickets, public.pickup_ticket_items, public.orders,
  public.order_items from anon;

-- A staff profile is required for every direct staff-table operation.
drop policy if exists "Authenticated staff manage customer orders" on public.customer_orders;
create policy "Authenticated staff manage customer orders"
on public.customer_orders for all to authenticated
using (public.current_staff_role() is not null)
with check (public.current_staff_role() is not null);

drop policy if exists "Authenticated staff manage queue counters" on public.queue_counters;
create policy "Authenticated staff manage queue counters"
on public.queue_counters for all to authenticated
using (public.current_staff_role() is not null)
with check (public.current_staff_role() is not null);

drop policy if exists "Authenticated staff manage guest visits" on public.guest_visits;
create policy "Authenticated staff manage guest visits"
on public.guest_visits for all to authenticated
using (public.current_staff_role() is not null)
with check (public.current_staff_role() is not null);

drop policy if exists "Authenticated staff manage pickup tickets" on public.pickup_tickets;
create policy "Authenticated staff manage pickup tickets"
on public.pickup_tickets for all to authenticated
using (public.current_staff_role() is not null)
with check (public.current_staff_role() is not null);

drop policy if exists "Authenticated staff manage pickup ticket items" on public.pickup_ticket_items;
create policy "Authenticated staff manage pickup ticket items"
on public.pickup_ticket_items for all to authenticated
using (public.current_staff_role() is not null)
with check (public.current_staff_role() is not null);

-- The public display receives only a queue number and aggregate waiting count.
create or replace function public.get_public_queue_display(
  p_school_id text,
  p_outlet_name text default '',
  p_counter_name text default 'main',
  p_service_type text default 'FITTING'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'current_queue_number', coalesce(counter.current_queue_number, ''),
    'updated_at', counter.updated_at,
    'service_type', p_service_type,
    'counter_name', coalesce(p_counter_name, 'main'),
    'waiting_count', (
      select count(*)
      from public.customer_orders orders
      where orders.school_id = p_school_id
        and (orders.created_at at time zone 'Asia/Hong_Kong')::date = (now() at time zone 'Asia/Hong_Kong')::date
        and orders.status = case when p_service_type = 'PICKUP' then 'READY' else 'PENDING' end
    )
  )
  from (select 1) seed
  left join public.queue_counters counter
    on counter.school_id = p_school_id
   and counter.outlet_name = coalesce(p_outlet_name, '')
   and counter.counter_name = coalesce(p_counter_name, 'main')
   and counter.service_type = p_service_type;
$$;

-- The customer status lookup deliberately never returns customer_info or tailor_info.
create or replace function public.get_public_queue_status(
  p_school_id text,
  p_queue_number text default null,
  p_phone_last4 text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if nullif(trim(p_school_id), '') is null
     or (nullif(trim(p_queue_number), '') is null and nullif(trim(p_phone_last4), '') is null) then
    raise exception 'school and queue number or phone suffix are required';
  end if;
  if nullif(trim(p_queue_number), '') is null
     and length(regexp_replace(coalesce(p_phone_last4, ''), '\D', '', 'g')) <> 4 then
    raise exception 'phone suffix must be exactly four digits';
  end if;

  select jsonb_build_object(
    'queue_number', orders.queue_number,
    'status', orders.status,
    'queue_position', (
      select count(*)
      from public.customer_orders preceding
      where preceding.school_id = orders.school_id
        and (preceding.created_at at time zone 'Asia/Hong_Kong')::date = (now() at time zone 'Asia/Hong_Kong')::date
        and preceding.status not in ('COMPLETED', 'SKIPPED')
        and (preceding.created_at, preceding.id) <= (orders.created_at, orders.id)
    )
  ) into result
  from public.customer_orders orders
  where orders.school_id = p_school_id
    and (orders.created_at at time zone 'Asia/Hong_Kong')::date = (now() at time zone 'Asia/Hong_Kong')::date
    and (
      (nullif(trim(p_queue_number), '') is not null and orders.queue_number = trim(p_queue_number))
      or (nullif(trim(p_phone_last4), '') is not null
          and regexp_replace(coalesce(orders.customer_info ->> 'phone', ''), '\D', '', 'g') like '%' || regexp_replace(p_phone_last4, '\D', '', 'g'))
    )
  order by orders.created_at desc
  limit 1;
  return result;
end;
$$;

-- Public registration may create an order, but cannot choose its id, queue
-- number, status, business date, or staff-only tailor fields.
create or replace function public.create_customer_order(order_data jsonb)
returns public.customer_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.customer_orders;
  school text := nullif(trim(order_data ->> 'school_id'), '');
  customer jsonb := coalesce(order_data -> 'customer_info', '{}'::jsonb);
  hk_day date := (now() at time zone 'Asia/Hong_Kong')::date;
  next_number integer;
begin
  if school is null
     or nullif(trim(customer ->> 'guestName'), '') is null
     or nullif(trim(customer ->> 'className'), '') is null
     or length(regexp_replace(coalesce(customer ->> 'phone', ''), '\D', '', 'g')) < 4 then
    raise exception 'valid school, name, class, and phone are required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(school || ':' || hk_day::text, 0));
  select coalesce(max((regexp_match(queue_number, '([0-9]+)$'))[1]::integer), 0) + 1
    into next_number
  from public.customer_orders
  where school_id = school
    and (created_at at time zone 'Asia/Hong_Kong')::date = hk_day;

  insert into public.customer_orders (id, school_id, queue_number, customer_info, tailor_info, status, created_at, updated_at)
  values (
    'co-' || extract(epoch from clock_timestamp())::bigint || '-' || substr(md5(random()::text), 1, 8),
    school,
    'A' || lpad(next_number::text, 3, '0'),
    customer,
    '{}'::jsonb,
    'PENDING',
    now(),
    now()
  ) returning * into result;
  return result;
end;
$$;

revoke all on function public.get_public_queue_display(text, text, text, text) from public;
revoke all on function public.get_public_queue_status(text, text, text) from public;
grant execute on function public.get_public_queue_display(text, text, text, text) to anon, authenticated;
grant execute on function public.get_public_queue_status(text, text, text) to anon, authenticated;
grant execute on function public.create_customer_order(jsonb) to anon, authenticated;
revoke all on function public.call_next_customer(varchar, varchar, varchar, varchar, uuid) from public, anon;
revoke all on function public.call_next_fitting_customer(varchar, varchar, varchar, uuid) from public, anon;
revoke all on function public.call_next_pickup_customer(varchar, varchar, varchar, uuid) from public, anon;
revoke all on function public.clear_queue_counter(varchar, varchar, varchar, varchar) from public, anon;
grant execute on function public.call_next_customer(varchar, varchar, varchar, varchar, uuid) to authenticated;
grant execute on function public.call_next_fitting_customer(varchar, varchar, varchar, uuid) to authenticated;
grant execute on function public.call_next_pickup_customer(varchar, varchar, varchar, uuid) to authenticated;
grant execute on function public.clear_queue_counter(varchar, varchar, varchar, varchar) to authenticated;

commit;
