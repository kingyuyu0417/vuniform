begin;

drop policy if exists "Authenticated staff can read orders" on public.orders;
drop policy if exists "Branch staff can read orders" on public.orders;

create policy "Branch staff can read orders"
on public.orders for select to authenticated
using (
  public.staff_can_access_branch(branch_id)
  and (
    public.current_staff_role() in ('admin', 'manager')
    or (
      public.current_staff_role() = 'staff'
      and (created_at at time zone 'Asia/Hong_Kong')::date =
          (now() at time zone 'Asia/Hong_Kong')::date
    )
    or (
      public.current_staff_role() <> 'staff'
      and cashier_id = auth.uid()
    )
  )
);

drop policy if exists "Authenticated staff can read order items" on public.order_items;
drop policy if exists "Branch staff can read order items" on public.order_items;

create policy "Branch staff can read order items"
on public.order_items for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and public.staff_can_access_branch(o.branch_id)
      and (
        public.current_staff_role() in ('admin', 'manager')
        or (
          public.current_staff_role() = 'staff'
          and (o.created_at at time zone 'Asia/Hong_Kong')::date =
              (now() at time zone 'Asia/Hong_Kong')::date
        )
        or (
          public.current_staff_role() <> 'staff'
          and o.cashier_id = auth.uid()
        )
      )
  )
);

commit;
