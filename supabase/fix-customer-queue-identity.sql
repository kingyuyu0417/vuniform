begin;

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

  insert into public.customer_orders (
    id, school_id, queue_number, customer_info, tailor_info, status, created_at, updated_at
  ) values (
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
declare
  result jsonb;
  matching_count integer;
  normalized_phone text := regexp_replace(coalesce(p_phone_last4, ''), '\D', '', 'g');
begin
  if nullif(trim(p_school_id), '') is null
     or (nullif(trim(p_queue_number), '') is null and nullif(trim(p_phone_last4), '') is null) then
    raise exception 'school and queue number or phone suffix are required';
  end if;
  if nullif(trim(p_queue_number), '') is null and length(normalized_phone) <> 4 then
    raise exception 'phone suffix must be exactly four digits';
  end if;

  select count(*) into matching_count
  from public.customer_orders orders
  where orders.school_id = p_school_id
    and (orders.created_at at time zone 'Asia/Hong_Kong')::date = (now() at time zone 'Asia/Hong_Kong')::date
    and (
      (nullif(trim(p_queue_number), '') is not null and orders.queue_number = trim(p_queue_number))
      or (
        nullif(trim(p_queue_number), '') is null
        and regexp_replace(coalesce(orders.customer_info ->> 'phone', ''), '\D', '', 'g') like '%' || normalized_phone
      )
    )
    and (
      nullif(trim(p_phone_last4), '') is null
      or regexp_replace(coalesce(orders.customer_info ->> 'phone', ''), '\D', '', 'g') like '%' || normalized_phone
    );

  if matching_count > 1 then
    return jsonb_build_object('ambiguous', true, 'queue_number', nullif(trim(p_queue_number), ''));
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
      or (
        nullif(trim(p_queue_number), '') is null
        and regexp_replace(coalesce(orders.customer_info ->> 'phone', ''), '\D', '', 'g') like '%' || normalized_phone
      )
    )
    and (
      nullif(trim(p_phone_last4), '') is null
      or regexp_replace(coalesce(orders.customer_info ->> 'phone', ''), '\D', '', 'g') like '%' || normalized_phone
    )
  limit 1;

  return result;
end;
$$;

create or replace function public.get_public_queue_status_by_id(
  p_school_id text,
  p_order_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if nullif(trim(p_school_id), '') is null
     or nullif(trim(p_order_id), '') is null then
    raise exception 'school and order id are required';
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
  where orders.id = p_order_id
    and orders.school_id = p_school_id
    and (orders.created_at at time zone 'Asia/Hong_Kong')::date = (now() at time zone 'Asia/Hong_Kong')::date;

  return result;
end;
$$;

revoke all on function public.create_customer_order(jsonb) from public;
grant execute on function public.create_customer_order(jsonb) to anon, authenticated;
revoke all on function public.get_public_queue_status(text, text, text) from public;
grant execute on function public.get_public_queue_status(text, text, text) to anon, authenticated;
revoke all on function public.get_public_queue_status_by_id(text, text) from public;
grant execute on function public.get_public_queue_status_by_id(text, text) to anon, authenticated;

commit;
