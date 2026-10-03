drop policy if exists "Branch managers can insert products" on public.products;
create policy "Branch managers can insert products"
on public.products for insert to authenticated
with check (
  public.current_staff_role() = 'admin'
  or (
    public.current_staff_role() = 'manager'
    and public.staff_can_access_branch(branch_id)
  )
);
