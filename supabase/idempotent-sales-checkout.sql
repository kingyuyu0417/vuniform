-- Run after secure-migration.sql. Checkout keys prevent duplicate receipts;
-- Linked returns are quantity-checked; receiptless returns require the explicit
-- untracked_exchange marker and remain separate from source-linked exchanges.
begin;

alter table public.orders
  add column if not exists branch_id text,
  add column if not exists checkout_key text,
  add column if not exists checkout_payload_hash text,
  add column if not exists adjustment_reason text,
  add column if not exists untracked_exchange boolean not null default false,
  add column if not exists payment_method text not null default 'cash'
    check (payment_method in ('cash', 'card', 'transfer')),
  add column if not exists refund_method text
    check (refund_method is null or refund_method in ('cash', 'card', 'transfer')),
  add column if not exists duplicate_confirmed boolean not null default false,
  add column if not exists duplicate_source_receipt_id text,
  add column if not exists voided_at timestamptz;

do $$
begin
  if to_regclass('public.daily_receipt_sequences') is null then
    raise exception 'Run secure-migration.sql before idempotent-sales-checkout.sql';
  end if;
end;
$$;

alter table public.order_items
  add column if not exists length text,
  add column if not exists is_return boolean not null default false,
  add column if not exists source_order_item_id text,
  add column if not exists receipt_name_en text not null default '';

alter table public.products
  add column if not exists receipt_name_en text not null default '';

create unique index if not exists orders_cashier_checkout_key_unique
  on public.orders (cashier_id, checkout_key)
  where checkout_key is not null;

create index if not exists order_items_source_return_lookup
  on public.order_items (source_order_item_id)
  where is_return;

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
  payload_hash text := md5((
    order_data - 'created_at' - 'date' - 'time' - 'id' - 'createdAt'
      - case when coalesce(order_data ->> 'payment_method', 'cash') = 'cash' then 'payment_method' else '' end
      - case when coalesce(order_data ->> 'paymentMethod', 'cash') = 'cash' then 'paymentMethod' else '' end
      - case when coalesce(nullif(order_data ->> 'refund_method', ''), 'cash') = 'cash' then 'refund_method' else '' end
      - case when coalesce(nullif(order_data ->> 'refundMethod', ''), 'cash') = 'cash' then 'refundMethod' else '' end
      - case when coalesce((order_data ->> 'duplicate_confirmed')::boolean, false) then '' else 'duplicate_confirmed' end
      - case when coalesce((order_data ->> 'duplicateConfirmed')::boolean, false) then '' else 'duplicateConfirmed' end
      - case when nullif(order_data ->> 'duplicate_source_receipt_id', '') is null then 'duplicate_source_receipt_id' else '' end
      - case when nullif(order_data ->> 'duplicateSourceReceiptId', '') is null then 'duplicateSourceReceiptId' else '' end
  )::text);
  existing_hash text;
  requested_return record;
  original_qty integer;
  original_order_id text;
  original_school text;
  original_voided_at timestamptz;
  already_returned integer;
  is_untracked_exchange boolean := coalesce((order_data ->> 'untracked_exchange')::boolean, false);
begin
  if actor_id is null or nullif(order_data ->> 'cashier_id', '')::uuid is distinct from actor_id then
    raise exception 'cashier_id must match the signed-in user';
  end if;

  if request_key is null or char_length(request_key) > 100 then
    raise exception 'A valid checkout_key is required';
  end if;

  if (nullif(order_data ->> 'exchange_source_receipt_id', '') is not null or is_untracked_exchange)
     and nullif(btrim(order_data ->> 'adjustment_reason'), '') is null then
    raise exception 'An exchange reason is required';
  end if;

  if is_untracked_exchange then
    if nullif(order_data ->> 'exchange_source_receipt_id', '') is not null
       or not exists (
         select 1
         from jsonb_to_recordset(order_data -> 'items') as item(
           is_return boolean,
           source_order_item_id text
         )
         where coalesce(item.is_return, false)
       )
       or exists (
         select 1
         from jsonb_to_recordset(order_data -> 'items') as item(
           is_return boolean,
           source_order_item_id text
         )
         where coalesce(item.is_return, false)
           and nullif(item.source_order_item_id, '') is not null
       ) then
      raise exception 'Receiptless exchanges must contain only unlinked returns and no source receipt';
    end if;
  elsif exists (
    select 1
    from jsonb_to_recordset(order_data -> 'items') as item(
      is_return boolean,
      source_order_item_id text
    )
    where coalesce(item.is_return, false)
      and nullif(item.source_order_item_id, '') is null
  ) then
    raise exception 'Every returned item must reference its original order item';
  end if;

  if coalesce(order_data ->> 'payment_method', 'cash') not in ('cash', 'card', 'transfer') then
    raise exception 'Unsupported payment method';
  end if;

  if greatest(coalesce((order_data ->> 'refund_due')::integer, 0), 0) > 0
     and coalesce(order_data ->> 'refund_method', '') not in ('cash', 'card', 'transfer') then
    raise exception 'A valid refund method is required';
  end if;

  if coalesce((order_data ->> 'duplicate_confirmed')::boolean, false)
     and nullif(order_data ->> 'duplicate_source_receipt_id', '') is null then
    raise exception 'Confirmed duplicate warnings must reference the matching receipt';
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
    update public.order_items as saved_item
       set receipt_name_en = coalesce(item.receipt_name_en, '')
    from jsonb_to_recordset(order_data -> 'items') as item(
      name text,
      size text,
      length text,
      price integer,
      qty integer,
      is_return boolean,
      source_order_item_id text,
      receipt_name_en text
    )
    where saved_item.order_id = receipt_id
      and saved_item.name is not distinct from item.name
      and saved_item.size is not distinct from item.size
      and saved_item.length is not distinct from nullif(item.length, '')
      and saved_item.price = item.price
      and saved_item.qty = item.qty
      and saved_item.is_return = coalesce(item.is_return, false)
      and saved_item.source_order_item_id is not distinct from nullif(item.source_order_item_id, '');
    return receipt_id;
  end if;

  for requested_return in
    select item.source_order_item_id, sum(item.qty)::integer as requested_qty
    from jsonb_to_recordset(order_data -> 'items') as item(
      name text,
      size text,
      length text,
      price integer,
      qty integer,
      is_return boolean,
      source_order_item_id text
    )
    where coalesce(item.is_return, false)
      and nullif(item.source_order_item_id, '') is not null
    group by item.source_order_item_id
    order by item.source_order_item_id
  loop
    if nullif(requested_return.source_order_item_id, '') is null then
      raise exception 'Every returned item must reference its original order item';
    end if;

    select source_item.order_id
      into original_order_id
    from public.order_items as source_item
    where source_item.id::text = requested_return.source_order_item_id;

    if original_order_id is null then
      raise exception 'Original order item was not found';
    end if;

    if nullif(order_data ->> 'exchange_source_receipt_id', '') is distinct from original_order_id then
      raise exception 'Returned items must belong to the linked original receipt';
    end if;

    select source_order.school, source_order.voided_at
      into original_school, original_voided_at
    from public.orders as source_order
    where source_order.id = original_order_id
    for update;

    if not found or original_voided_at is not null then
      raise exception 'Original sale is unavailable for return';
    end if;

    if coalesce(order_data ->> 'school', '') is distinct from original_school then
      raise exception 'Returned items must belong to the linked original receipt and school';
    end if;

    select source_item.qty, source_item.order_id
      into original_qty, original_order_id
    from public.order_items as source_item
    where source_item.id::text = requested_return.source_order_item_id
      and not source_item.is_return
    for update;

    if original_qty is null then
      raise exception 'Original sale item was not found';
    end if;

    if exists (
      select 1
      from public.orders as legacy_adjustment
      where legacy_adjustment.exchange_source_receipt_id = original_order_id
        and legacy_adjustment.voided_at is null
        and not exists (
          select 1
          from public.order_items as tagged_return
          where tagged_return.order_id = legacy_adjustment.id
            and tagged_return.is_return
        )
    ) then
      raise exception 'This receipt has an older untracked exchange; manager review is required before another return';
    end if;

    select coalesce(sum(return_item.qty), 0)::integer
      into already_returned
    from public.order_items as return_item
    join public.orders as adjustment on adjustment.id = return_item.order_id
    where return_item.source_order_item_id = requested_return.source_order_item_id
      and return_item.is_return
      and adjustment.voided_at is null;

    if already_returned + requested_return.requested_qty > original_qty then
      raise exception 'Return quantity exceeds the quantity remaining on the original sale';
    end if;
  end loop;

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
    customer_surname, customer_phone_last4, exchange_source_receipt_id, adjustment_reason,
    untracked_exchange,
    payment_method, refund_method, refund_due,
    duplicate_confirmed, duplicate_source_receipt_id,
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
    nullif(btrim(order_data ->> 'adjustment_reason'), ''),
    is_untracked_exchange,
    coalesce(order_data ->> 'payment_method', 'cash'),
    nullif(order_data ->> 'refund_method', ''),
    greatest(coalesce((order_data ->> 'refund_due')::integer, 0), 0),
    coalesce((order_data ->> 'duplicate_confirmed')::boolean, false),
    nullif(order_data ->> 'duplicate_source_receipt_id', ''),
    actor_id,
    coalesce(order_data ->> 'cashier_name', ''),
    greatest((order_data ->> 'total')::integer, 0),
    (order_data ->> 'item_count')::integer,
    coalesce((order_data ->> 'created_at')::timestamptz, now()),
    request_key,
    payload_hash
  );

  insert into public.order_items (order_id, name, size, length, price, qty, is_return, source_order_item_id, receipt_name_en)
  select
    receipt_id,
    item.name,
    item.size,
    nullif(item.length, ''),
    item.price,
    item.qty,
    coalesce(item.is_return, false),
    nullif(item.source_order_item_id, ''),
    coalesce(item.receipt_name_en, '')
  from jsonb_to_recordset(order_data -> 'items')
    as item(
      name text,
      size text,
      length text,
      price integer,
      qty integer,
      is_return boolean,
      source_order_item_id text,
      receipt_name_en text
    );

  return receipt_id;
end;
$$;

revoke all on function public.create_order_idempotently(jsonb, text) from public, anon;
grant execute on function public.create_order_idempotently(jsonb, text) to authenticated;
revoke all on function public.create_order_with_items(jsonb) from public, anon, authenticated;
revoke insert on public.orders, public.order_items from authenticated;

commit;
