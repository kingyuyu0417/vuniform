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
begin
  select * into next_order
  from public.customer_orders
  where school_id = p_school_id and status = case when p_service_type = 'PICKUP' then 'READY' else 'PENDING' end
  order by created_at asc
  for update skip locked
  limit 1;

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

create or replace function public.call_next_fitting_customer(
  p_school_id varchar,
  p_outlet_name varchar default '',
  p_counter_name varchar default 'main',
  p_called_by uuid default null
)
returns public.queue_counters
language sql
security definer
set search_path = public
as $$
declare
  next_order public.customer_orders%rowtype;
  result public.queue_counters;
begin
  select * into next_order from public.customer_orders
  where school_id = p_school_id and status = 'PENDING'
  order by created_at asc for update skip locked limit 1;
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
language sql
security definer
set search_path = public
as $$
declare
  next_order public.customer_orders%rowtype;
  result public.queue_counters;
begin
  select * into next_order from public.customer_orders
  where school_id = p_school_id and status = 'READY'
  order by created_at asc for update skip locked limit 1;
  insert into public.queue_counters (school_id, outlet_name, counter_name, service_type, current_order_id, current_queue_number, updated_at, updated_by)
  values (p_school_id, coalesce(p_outlet_name, ''), 'pickup', 'PICKUP', next_order.id, next_order.queue_number, now(), p_called_by)
  on conflict (school_id, outlet_name, counter_name, service_type) do update set current_order_id = excluded.current_order_id, current_queue_number = excluded.current_queue_number, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning * into result;
  return result;
end;
$$;
