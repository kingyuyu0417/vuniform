-- Preserve the original receipt reference on exchange transactions.
alter table public.orders
  add column if not exists exchange_source_receipt_id text;

create or replace function public.create_order_with_items(order_data jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_receipt_date date := (now() at time zone 'Asia/Hong_Kong')::date;
  receipt_number integer;
  receipt_id text;
begin
  if (order_data ->> 'cashier_id')::uuid <> auth.uid() then
    raise exception 'cashier_id must match the signed-in user';
  end if;

  insert into public.daily_receipt_sequences (receipt_date, last_number)
  values (current_receipt_date, 1)
  on conflict (receipt_date) do update set last_number = daily_receipt_sequences.last_number + 1
  returning last_number into receipt_number;
  receipt_id := format('VU-%s-%s', to_char(current_receipt_date, 'YYYYMMDD'), lpad(receipt_number::text, 4, '0'));

  insert into public.orders (
    id, school, outlet_name, outlet_address, outlet_phone,
    customer_surname, customer_phone_last4, exchange_source_receipt_id,
    cashier_id, cashier_name, total, item_count, created_at
  )
  values (
    receipt_id,
    coalesce(order_data ->> 'school', ''),
    nullif(order_data ->> 'outletName', ''),
    nullif(order_data ->> 'outletAddress', ''),
    nullif(order_data ->> 'outletPhone', ''),
    nullif(order_data ->> 'customer_surname', ''),
    nullif(order_data ->> 'customer_phone_last4', ''),
    nullif(order_data ->> 'exchange_source_receipt_id', ''),
    auth.uid(),
    coalesce(order_data ->> 'cashier_name', ''),
    (order_data ->> 'total')::integer,
    (order_data ->> 'item_count')::integer,
    coalesce((order_data ->> 'created_at')::timestamptz, now())
  );

  insert into public.order_items (order_id, name, size, length, price, qty)
  select receipt_id, item.name, item.size, nullif(item.length, ''), item.price, item.qty
  from jsonb_to_recordset(order_data -> 'items') as item(name text, size text, length text, price integer, qty integer);

  return receipt_id;
end;
$$;

grant execute on function public.create_order_with_items(jsonb) to authenticated;
