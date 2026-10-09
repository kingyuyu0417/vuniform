-- Run after idempotent-sales-checkout.sql, void-sales-order.sql, and branch-isolation-migration.sql.
begin;

alter table public.orders
  add column if not exists replacement_source_receipt_id text references public.orders(id),
  add column if not exists replacement_reason text,
  add column if not exists settlement_delta integer not null default 0,
  add column if not exists replacement_cash_received integer not null default 0,
  add column if not exists replacement_change_due integer not null default 0;

create index if not exists orders_replacement_source_receipt_id_idx
  on public.orders (replacement_source_receipt_id)
  where replacement_source_receipt_id is not null;

create or replace function public.replace_sales_order_idempotently(
  order_data jsonb,
  p_checkout_key text,
  p_source_order_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  replacement_id text;
  source_total integer;
  source_school text;
  source_branch_id text;
  source_voided_at timestamptz;
  source_void_reason text;
  new_total integer := greatest(coalesce((order_data ->> 'total')::integer, 0), 0);
  expected_delta integer;
  requested_delta integer := coalesce((order_data ->> 'settlement_delta')::integer, 0);
  requested_reason text := btrim(coalesce(p_reason, ''));
  receipt_number_voided_at timestamptz;
  void_reason_value text;
  requested_item_total integer;
  requested_item_count integer;
  invalid_item_count integer;
begin
  if actor_id is null
     or public.current_staff_role() is null
     or nullif(order_data ->> 'cashier_id', '')::uuid is distinct from actor_id then
    raise exception 'An authenticated cashier must replace their own sale';
  end if;

  if nullif(btrim(p_checkout_key), '') is null or char_length(p_checkout_key) > 100 then
    raise exception 'A valid checkout_key is required';
  end if;

  if nullif(btrim(p_source_order_id), '') is null
     or nullif(order_data ->> 'replacement_source_receipt_id', '') is distinct from p_source_order_id then
    raise exception 'Replacement must identify the original receipt';
  end if;

  if char_length(requested_reason) not between 1 and 500
     or nullif(btrim(order_data ->> 'replacement_reason'), '') is distinct from requested_reason then
    raise exception 'A replacement reason between 1 and 500 characters is required';
  end if;

  if nullif(order_data ->> 'exchange_source_receipt_id', '') is not null
     or exists (
       select 1
       from jsonb_to_recordset(coalesce(order_data -> 'items', '[]'::jsonb)) as item(is_return boolean)
       where coalesce(item.is_return, false)
     ) then
    raise exception 'A full-sale replacement must contain only the new sale items';
  end if;

  select coalesce(sum(item.price * item.qty), 0)::integer,
         coalesce(sum(item.qty), 0)::integer,
         count(*) filter (
           where item.price is null
              or item.qty is null
              or item.price < 0
              or item.qty <= 0
              or coalesce(item.is_return, false)
         )::integer
    into requested_item_total, requested_item_count, invalid_item_count
  from jsonb_to_recordset(coalesce(order_data -> 'items', '[]'::jsonb))
    as item(price integer, qty integer, is_return boolean);

  if invalid_item_count > 0
     or requested_item_total <> new_total
     or requested_item_count <> coalesce((order_data ->> 'item_count')::integer, -1) then
    raise exception 'Replacement total and item count must match its item rows';
  end if;

  select o.total::integer, o.school, o.branch_id, o.voided_at, o.void_reason
    into source_total, source_school, source_branch_id, source_voided_at, source_void_reason
  from public.orders as o
  where o.id = p_source_order_id
  for update;

  if not found then
    raise exception 'Original receipt not found';
  end if;

  if not public.staff_can_access_branch(source_branch_id) then
    raise exception 'Staff cannot replace a receipt outside their branch';
  end if;

  if coalesce(order_data ->> 'school', '') is distinct from coalesce(source_school, '') then
    raise exception 'Replacement must stay in the original school';
  end if;

  if coalesce(order_data ->> 'branch_id', '') is distinct from coalesce(source_branch_id, '') then
    raise exception 'Replacement must stay in the original branch';
  end if;

  if exists (
    select 1
    from public.orders as source_order
    where source_order.id = p_source_order_id
      and (
        source_order.exchange_source_receipt_id is not null
        or source_order.replacement_source_receipt_id is not null
      )
  ) then
    raise exception 'Only an original sale can be replaced';
  end if;

  expected_delta := new_total - coalesce(source_total, 0);
  if requested_delta <> expected_delta then
    raise exception 'Settlement difference does not match the original and replacement totals';
  end if;

  if greatest(coalesce((order_data ->> 'refund_due')::integer, 0), 0) <> greatest(-expected_delta, 0) then
    raise exception 'Refund amount does not match the replacement difference';
  end if;

  if expected_delta > 0 then
    if coalesce(order_data ->> 'payment_method', 'cash') = 'cash' then
      if coalesce((order_data ->> 'replacement_cash_received')::integer, 0) < expected_delta
         or coalesce((order_data ->> 'replacement_change_due')::integer, 0) < 0
         or coalesce((order_data ->> 'replacement_cash_received')::integer, 0)
           - coalesce((order_data ->> 'replacement_change_due')::integer, 0) <> expected_delta then
        raise exception 'Cash collected must equal the replacement difference after change';
      end if;
    elsif coalesce((order_data ->> 'replacement_cash_received')::integer, 0) <> 0
       or coalesce((order_data ->> 'replacement_change_due')::integer, 0) <> 0 then
      raise exception 'Cash tender fields are only valid for cash settlements';
    end if;
  elsif coalesce((order_data ->> 'replacement_cash_received')::integer, 0) <> 0
     or coalesce((order_data ->> 'replacement_change_due')::integer, 0) <> 0 then
    raise exception 'Cash tender fields are not valid when no amount is collected';
  end if;

  replacement_id := public.create_order_idempotently(order_data, p_checkout_key);

  if source_voided_at is not null then
    select o.id
      into replacement_id
    from public.orders as o
    where o.cashier_id = actor_id
      and o.checkout_key = p_checkout_key
      and o.id = replacement_id
      and o.replacement_source_receipt_id = p_source_order_id
      and o.replacement_reason = requested_reason;

    if replacement_id is not null
       and source_void_reason = format('整單已由新單 #%s 替換：%s', replacement_id, requested_reason) then
      return jsonb_build_object(
        'receipt_id', replacement_id,
        'replaced_receipt_id', p_source_order_id,
        'voided_at', source_voided_at,
        'void_reason', source_void_reason
      );
    end if;
    raise exception 'Original receipt is already voided';
  end if;

  if exists (
    select 1
    from public.orders as related
    where related.voided_at is null
      and (
        related.exchange_source_receipt_id = p_source_order_id
        or related.replacement_source_receipt_id = p_source_order_id
      )
  ) then
    raise exception 'Original receipt already has an active return, exchange, or replacement';
  end if;

  update public.orders
  set replacement_source_receipt_id = p_source_order_id,
      replacement_reason = requested_reason,
      settlement_delta = expected_delta,
      replacement_cash_received = greatest(coalesce((order_data ->> 'replacement_cash_received')::integer, 0), 0),
      replacement_change_due = greatest(coalesce((order_data ->> 'replacement_change_due')::integer, 0), 0),
      adjustment_reason = requested_reason
  where id = replacement_id
    and cashier_id = actor_id
    and checkout_key = p_checkout_key;

  if not found then
    raise exception 'Replacement receipt could not be linked to the original sale';
  end if;

  void_reason_value := format('整單已由新單 #%s 替換：%s', replacement_id, requested_reason);

  update public.orders
  set voided_at = now(),
      voided_by = actor_id,
      void_reason = void_reason_value
  where id = p_source_order_id
    and voided_at is null
  returning voided_at into receipt_number_voided_at;

  if receipt_number_voided_at is null then
    raise exception 'Original receipt was concurrently changed; replacement cancelled';
  end if;

  insert into public.order_void_audit (order_id, actor_id, reason, created_at)
  values (p_source_order_id, actor_id, void_reason_value, receipt_number_voided_at);

  return jsonb_build_object(
    'receipt_id', replacement_id,
    'replaced_receipt_id', p_source_order_id,
    'voided_at', receipt_number_voided_at,
    'void_reason', void_reason_value
  );
end;
$$;

revoke all on function public.replace_sales_order_idempotently(jsonb, text, text, text) from public, anon;
grant execute on function public.replace_sales_order_idempotently(jsonb, text, text, text) to authenticated;

commit;
