-- Run after secure-migration.sql. Repeated calls with the same cashier/key return
-- the original receipt instead of inserting another order.
begin;

alter table public.orders
  add column if not exists branch_id text,
  add column if not exists checkout_key text,
  add column if not exists checkout_payload_hash text;

do $$
begin
  if to_regclass('public.daily_receipt_sequences') is null then
    raise exception 'Run secure-migration.sql before idempotent-sales-checkout.sql';
  end if;
end;
$$;

alter table public.order_items
  add column if not exists length text;

create unique index if not exists orders_cashier_checkout_key_unique
  on public.orders (cashier_id, checkout_key)
  where checkout_key is not null;

create or replace function public.create_order_idempotently(order_data jsonb, p_checkout_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  current_receipt_date date := (now() at time zone 'Asia/Hong_Kong')::date;
  receipt_number integer;
  receipt_id text;
  request_key text := nullif(p_checkout_key, '');
  payload_hash text := md5((order_data - 'created_at' - 'date' - 'time' - 'id')::text);
  existing_hash text;
begin
  if actor_id is null or nullif(order_data ->> 'cashier_id', '')::uuid is distinct from actor_id then
    raise exception 'cashier_id must match the signed-in user';
  end if;

  if request_key is null or char_length(request_key) > 100 then
    raise exception 'A valid checkout_key is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_id::text || ':' || request_key, 0));

  select o.id, o.checkout_payload_hash
    into receipt_id, existing_hash
  from public.orders as o
  where o.cashier_id = actor_id
    and o.checkout_key = request_key
  for update;

  if receipt_id is not null then
    if existing_hash is distinct from payload_hash then
      raise exception 'checkout_key was already used for a different order';
    end if;
    return receipt_id;
  end if;

  insert into public.daily_receipt_sequences (receipt_date, last_number)
  values (current_receipt_date, 1)
  on conflict (receipt_date) do update
    set last_number = daily_receipt_sequences.last_number + 1
  returning last_number into receipt_number;

  receipt_id := format(
    'VU-%s-%s',
    to_char(current_receipt_date, 'YYYYMMDD'),
    lpad(receipt_number::text, 4, '0')
  );

  insert into public.orders (
    id, school, branch_id, outlet_name, outlet_address, outlet_phone,
    customer_surname, customer_phone_last4, exchange_source_receipt_id, refund_due,
    cashier_id, cashier_name, total, item_count, created_at,
    checkout_key, checkout_payload_hash
  )
  values (
    receipt_id,
    coalesce(order_data ->> 'school', ''),
    nullif(order_data ->> 'branch_id', ''),
    nullif(order_data ->> 'outlet_name', ''),
    nullif(order_data ->> 'outlet_address', ''),
    nullif(order_data ->> 'outlet_phone', ''),
    nullif(order_data ->> 'customer_surname', ''),
    nullif(order_data ->> 'customer_phone_last4', ''),
    nullif(order_data ->> 'exchange_source_receipt_id', ''),
    greatest(coalesce((order_data ->> 'refund_due')::integer, 0), 0),
    actor_id,
    coalesce(order_data ->> 'cashier_name', ''),
    greatest((order_data ->> 'total')::integer, 0),
    (order_data ->> 'item_count')::integer,
    coalesce((order_data ->> 'created_at')::timestamptz, now()),
    request_key,
    payload_hash
  );

  insert into public.order_items (order_id, name, size, length, price, qty)
  select receipt_id, item.name, item.size, nullif(item.length, ''), item.price, item.qty
  from jsonb_to_recordset(order_data -> 'items')
    as item(name text, size text, length text, price integer, qty integer);

  return receipt_id;
end;
$$;

revoke all on function public.create_order_idempotently(jsonb, text) from public, anon;
grant execute on function public.create_order_idempotently(jsonb, text) to authenticated;
revoke all on function public.create_order_with_items(jsonb) from public, anon, authenticated;
revoke insert on public.orders, public.order_items from authenticated;

commit;
