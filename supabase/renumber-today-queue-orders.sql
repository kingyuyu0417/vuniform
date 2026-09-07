-- Renumber today's queue orders per school as A001, A002, A003...
-- Hong Kong business date only. Historical orders are unchanged.
begin;

with ranked_orders as (
  select
    id,
    row_number() over (partition by school_id order by created_at, id) as sequence_number
  from public.customer_orders
  where (created_at at time zone 'Asia/Hong_Kong')::date = (now() at time zone 'Asia/Hong_Kong')::date
), staged_orders as (
  update public.customer_orders orders
  set queue_number = '__RENumber__' || orders.id,
      updated_at = now()
  where orders.id in (select id from ranked_orders)
  returning orders.id
), updated_orders as (
  update public.customer_orders orders
  set queue_number = 'A' || lpad(ranked_orders.sequence_number::text, 3, '0'),
      updated_at = now()
  from ranked_orders
  where orders.id = ranked_orders.id
  returning orders.id, orders.queue_number
)
select count(*) as renumbered_orders from updated_orders;

update public.queue_counters counters
set current_queue_number = orders.queue_number,
    updated_at = now()
from public.customer_orders orders
where counters.current_order_id = orders.id
  and (orders.created_at at time zone 'Asia/Hong_Kong')::date = (now() at time zone 'Asia/Hong_Kong')::date;

commit;

-- Verify today's result after running the migration.
select school_id, queue_number, created_at
from public.customer_orders
where (created_at at time zone 'Asia/Hong_Kong')::date = (now() at time zone 'Asia/Hong_Kong')::date
order by school_id, created_at, id;
