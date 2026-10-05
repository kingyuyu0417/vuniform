-- Independent calling state for the public display and staff queue console.
create table if not exists public.queue_counters (
  school_id varchar not null,
  outlet_name varchar not null default '',
  counter_name varchar not null default 'main',
  service_type varchar not null default 'FITTING',
  current_order_id text,
  current_queue_number varchar,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (school_id, outlet_name, counter_name, service_type)
);

alter table public.queue_counters add column if not exists service_type varchar not null default 'FITTING';
alter table public.queue_counters drop constraint if exists queue_counters_pkey;
alter table public.queue_counters add primary key (school_id, outlet_name, counter_name, service_type);

alter table public.queue_counters enable row level security;
drop policy if exists "Allow queue counter access" on public.queue_counters;
create policy "Allow queue counter access"
on public.queue_counters for all to anon using (true) with check (true);

alter table public.queue_counters replica identity full;

create index if not exists customer_orders_queue_lookup_idx
on public.customer_orders (school_id, status, created_at);

create index if not exists customer_orders_pickup_queue_lookup_idx
on public.customer_orders (school_id, status, created_at)
where not (tailor_info ? 'pickup_called_at');

create index if not exists customer_orders_fitting_queue_lookup_idx
on public.customer_orders (school_id, status, created_at)
where not (tailor_info ? 'fitting_called_at');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'queue_counters'
  ) then
    alter publication supabase_realtime add table public.queue_counters;
  end if;
end
$$;

create or replace function public.call_next_customer(
  p_school_id varchar,
  p_outlet_name varchar default '',
  p_counter_name varchar default 'main',
  p_service_type varchar default 'FITTING',
  p_called_by uuid default null
)
returns public.queue_counters
language plpgsql
security definer
set search_path = public
as $$
declare
  next_order public.customer_orders%rowtype;
  result public.queue_counters;
  day_start timestamptz := ((now() at time zone 'Asia/Hong_Kong')::date::timestamp at time zone 'Asia/Hong_Kong');
begin
  perform pg_advisory_xact_lock(hashtextextended(p_school_id || '::' || coalesce(p_outlet_name, '') || '::' || coalesce(p_service_type, 'FITTING'), 0));

  select * into result
  from public.queue_counters
  where school_id = p_school_id
    and outlet_name = coalesce(p_outlet_name, '')
    and counter_name = coalesce(p_counter_name, 'main')
    and service_type = coalesce(p_service_type, 'FITTING')
  for update;
  if found and result.current_order_id is not null and result.updated_at >= day_start then
    return result;
  end if;

  select * into next_order
  from public.customer_orders
  where school_id = p_school_id
    and status = case when p_service_type = 'PICKUP' then 'READY' else 'PENDING' end
    and created_at >= day_start
    and created_at < day_start + interval '1 day'
    and (
      (p_service_type = 'PICKUP' and not (tailor_info ? 'pickup_called_at'))
      or (p_service_type <> 'PICKUP' and not (tailor_info ? 'fitting_called_at'))
    )
  order by created_at asc
  for update skip locked
  limit 1;

  if next_order.id is not null and p_service_type <> 'PICKUP' then
    update public.customer_orders
    set tailor_info = coalesce(tailor_info, '{}'::jsonb) || jsonb_build_object('fitting_called_at', now()),
        updated_at = now()
    where id = next_order.id
    returning * into next_order;
  end if;

  insert into public.queue_counters (school_id, outlet_name, counter_name, service_type, current_order_id, current_queue_number, updated_at, updated_by)
  values (p_school_id, coalesce(p_outlet_name, ''), coalesce(p_counter_name, 'main'), coalesce(p_service_type, 'FITTING'), next_order.id, next_order.queue_number, now(), p_called_by)
  on conflict (school_id, outlet_name, counter_name, service_type) do update set
    current_order_id = excluded.current_order_id,
    current_queue_number = excluded.current_queue_number,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning * into result;

  return result;
end;
$$;

create or replace function public.clear_queue_counter(
  p_school_id varchar,
  p_outlet_name varchar default '',
  p_counter_name varchar default 'main',
  p_service_type varchar default 'FITTING'
)
returns public.queue_counters
language plpgsql
security definer
set search_path = public
as $$
declare result public.queue_counters;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_school_id || '::' || coalesce(p_outlet_name, '') || '::' || coalesce(p_service_type, 'FITTING'), 0));
  insert into public.queue_counters (school_id, outlet_name, counter_name, service_type, current_order_id, current_queue_number, updated_at)
  values (p_school_id, coalesce(p_outlet_name, ''), coalesce(p_counter_name, 'main'), coalesce(p_service_type, 'FITTING'), null, null, now())
  on conflict (school_id, outlet_name, counter_name, service_type) do update set
    current_order_id = null,
    current_queue_number = null,
    updated_at = now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.clear_queue_counter_if_current(
  p_school_id varchar,
  p_outlet_name varchar,
  p_counter_name varchar,
  p_service_type varchar,
  p_expected_order_id text
)
returns public.queue_counters
language plpgsql
security definer
set search_path = public
as $$
declare result public.queue_counters;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_school_id || '::' || coalesce(p_outlet_name, '') || '::' || coalesce(p_service_type, 'FITTING'), 0));

  select * into result
  from public.queue_counters
  where school_id = p_school_id
    and outlet_name = coalesce(p_outlet_name, '')
    and counter_name = coalesce(p_counter_name, 'main')
    and service_type = coalesce(p_service_type, 'FITTING')
  for update;

  if not found or result.current_order_id is distinct from p_expected_order_id then
    raise exception '目前叫號已變更，請重新整理後再試';
  end if;

  update public.queue_counters
  set current_order_id = null,
      current_queue_number = null,
      updated_at = now()
  where school_id = p_school_id
    and outlet_name = coalesce(p_outlet_name, '')
    and counter_name = coalesce(p_counter_name, 'main')
    and service_type = coalesce(p_service_type, 'FITTING')
  returning * into result;
  return result;
end;
$$;

drop function if exists public.call_next_fitting_customer(varchar, varchar, varchar, uuid);
drop function if exists public.call_next_pickup_customer(varchar, varchar, varchar, uuid);

create or replace function public.call_next_fitting_customer(
  p_school_id varchar,
  p_outlet_name varchar default '',
  p_counter_name varchar default 'main',
  p_called_by uuid default null
)
returns public.queue_counters
language plpgsql
security definer
set search_path = public
as $$
declare
  next_order public.customer_orders%rowtype;
  result public.queue_counters;
  day_start timestamptz := ((now() at time zone 'Asia/Hong_Kong')::date::timestamp at time zone 'Asia/Hong_Kong');
begin
  perform pg_advisory_xact_lock(hashtextextended(p_school_id || '::' || coalesce(p_outlet_name, '') || '::FITTING', 0));

  select * into result
  from public.queue_counters
  where school_id = p_school_id
    and outlet_name = coalesce(p_outlet_name, '')
    and counter_name = 'fitting'
    and service_type = 'FITTING'
  for update;
  if found and result.current_order_id is not null and result.updated_at >= day_start then
    return result;
  end if;

  select * into next_order from public.customer_orders
  where school_id = p_school_id
    and status = 'PENDING'
    and created_at >= day_start
    and created_at < day_start + interval '1 day'
    and not (tailor_info ? 'fitting_called_at')
  order by created_at asc for update skip locked limit 1;

  if next_order.id is not null then
    update public.customer_orders
    set tailor_info = coalesce(tailor_info, '{}'::jsonb) || jsonb_build_object('fitting_called_at', now()),
        updated_at = now()
    where id = next_order.id
    returning * into next_order;
  end if;

  insert into public.queue_counters (school_id, outlet_name, counter_name, service_type, current_order_id, current_queue_number, updated_at, updated_by)
  values (p_school_id, coalesce(p_outlet_name, ''), 'fitting', 'FITTING', next_order.id, next_order.queue_number, now(), p_called_by)
  on conflict (school_id, outlet_name, counter_name, service_type) do update set current_order_id = excluded.current_order_id, current_queue_number = excluded.current_queue_number, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning * into result;
  return result;
end;
$$;

create or replace function public.call_next_pickup_customer(
  p_school_id varchar,
  p_outlet_name varchar default '',
  p_counter_name varchar default 'main',
  p_called_by uuid default null
)
returns public.queue_counters
language plpgsql
security definer
set search_path = public
as $$
declare
  next_order public.customer_orders%rowtype;
  result public.queue_counters;
  day_start timestamptz := ((now() at time zone 'Asia/Hong_Kong')::date::timestamp at time zone 'Asia/Hong_Kong');
begin
  perform pg_advisory_xact_lock(hashtextextended(p_school_id || '::' || coalesce(p_outlet_name, '') || '::PICKUP', 0));

  select * into result
  from public.queue_counters
  where school_id = p_school_id
    and outlet_name = coalesce(p_outlet_name, '')
    and counter_name = 'pickup'
    and service_type = 'PICKUP'
  for update;
  if found and result.current_order_id is not null and result.updated_at >= day_start then
    return result;
  end if;

  select * into next_order from public.customer_orders
  where school_id = p_school_id
    and status = 'READY'
    and created_at >= day_start
    and created_at < day_start + interval '1 day'
    and not (tailor_info ? 'pickup_called_at')
  order by created_at asc for update skip locked limit 1;
  insert into public.queue_counters (school_id, outlet_name, counter_name, service_type, current_order_id, current_queue_number, updated_at, updated_by)
  values (p_school_id, coalesce(p_outlet_name, ''), 'pickup', 'PICKUP', next_order.id, next_order.queue_number, now(), p_called_by)
  on conflict (school_id, outlet_name, counter_name, service_type) do update set current_order_id = excluded.current_order_id, current_queue_number = excluded.current_queue_number, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning * into result;
  return result;
end;
$$;

create or replace function public.call_specific_queue_customer(
  p_school_id varchar,
  p_outlet_name varchar,
  p_counter_name varchar,
  p_service_type varchar,
  p_order_id text,
  p_queue_number varchar,
  p_called_by uuid default null
)
returns public.queue_counters
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.queue_counters;
  target_order public.customer_orders%rowtype;
  day_start timestamptz := ((now() at time zone 'Asia/Hong_Kong')::date::timestamp at time zone 'Asia/Hong_Kong');
begin
  perform pg_advisory_xact_lock(hashtextextended(p_school_id || '::' || coalesce(p_outlet_name, '') || '::' || coalesce(p_service_type, 'FITTING'), 0));

  select * into result
  from public.queue_counters
  where school_id = p_school_id
    and outlet_name = coalesce(p_outlet_name, '')
    and counter_name = coalesce(p_counter_name, 'main')
    and service_type = coalesce(p_service_type, 'FITTING')
  for update;
  if found and result.current_order_id is not null and result.updated_at >= day_start then
    if result.current_order_id = p_order_id then
      return result;
    end if;
    raise exception '此叫號櫃台目前仍有客人，請先完成或清除現有叫號';
  end if;

  select * into target_order
  from public.customer_orders
  where id = p_order_id
    and school_id = p_school_id
    and status = case when p_service_type = 'PICKUP' then 'READY' else 'PENDING' end
    and created_at >= day_start
    and created_at < day_start + interval '1 day'
  for update;
  if not found then
    raise exception '此客人已不在可叫號狀態，請重新整理排隊資料';
  end if;

  if p_service_type = 'PICKUP' then
    if target_order.tailor_info ? 'pickup_called_at' then
      raise exception '此取貨訂單已轉交處理，不能再次叫號';
    end if;
  else
    update public.customer_orders
    set tailor_info = coalesce(tailor_info, '{}'::jsonb) || jsonb_build_object('fitting_called_at', now()),
        updated_at = now()
    where id = target_order.id;
  end if;

  insert into public.queue_counters (school_id, outlet_name, counter_name, service_type, current_order_id, current_queue_number, updated_at, updated_by)
  values (p_school_id, coalesce(p_outlet_name, ''), coalesce(p_counter_name, 'main'), p_service_type, target_order.id, coalesce(target_order.queue_number, p_queue_number), now(), p_called_by)
  on conflict (school_id, outlet_name, counter_name, service_type) do update set
    current_order_id = excluded.current_order_id,
    current_queue_number = excluded.current_queue_number,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning * into result;
  return result;
end;
$$;

revoke all on function public.clear_queue_counter_if_current(varchar, varchar, varchar, varchar, text) from public, anon;
grant execute on function public.clear_queue_counter_if_current(varchar, varchar, varchar, varchar, text) to authenticated;
revoke all on function public.call_specific_queue_customer(varchar, varchar, varchar, varchar, text, varchar, uuid) from public, anon;
grant execute on function public.call_specific_queue_customer(varchar, varchar, varchar, varchar, text, varchar, uuid) to authenticated;
