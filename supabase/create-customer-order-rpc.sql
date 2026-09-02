-- Atomic customer order creation with a Hong Kong business date.
-- Run after schema.sql. This prevents duplicate queue numbers across devices.

create or replace function public.create_customer_order(order_data jsonb)
returns public.customer_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.customer_orders;
  school text := nullif(trim(order_data->>'school_id'), '');
  hk_day date := (now() at time zone 'Asia/Hong_Kong')::date;
  next_number integer;
begin
  if school is null then
    raise exception 'school_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(school || ':' || hk_day::text, 0));

  select coalesce(max((regexp_match(queue_number, '-([0-9]+)$'))[1]::integer), 0) + 1
    into next_number
  from public.customer_orders
  where school_id = school
    and (created_at at time zone 'Asia/Hong_Kong')::date = hk_day;

  insert into public.customer_orders (
    id, school_id, queue_number, customer_info, tailor_info, status, created_at, updated_at
  ) values (
    coalesce(nullif(order_data->>'id', ''), 'co-' || extract(epoch from clock_timestamp())::bigint || '-' || substr(md5(random()::text), 1, 8)),
    school,
    coalesce(nullif(order_data->>'queue_number', ''), upper(substr(school, 1, 1)) || '-' || lpad(next_number::text, 3, '0')),
    coalesce(order_data->'customer_info', '{}'::jsonb),
    coalesce(order_data->'tailor_info', '{}'::jsonb),
    'PENDING',
    coalesce((order_data->>'created_at')::timestamptz, now()),
    now()
  ) returning * into result;

  return result;
end;
$$;

grant execute on function public.create_customer_order(jsonb) to anon, authenticated;

-- Replace the old index, whose created_at component made duplicate queue numbers possible.
drop index if exists public.customer_orders_school_day_queue_unique;
create unique index if not exists customer_orders_school_day_queue_unique
  on public.customer_orders (
    school_id,
    ((created_at at time zone 'Asia/Hong_Kong')::date),
    queue_number
  );
