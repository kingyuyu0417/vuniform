drop policy if exists "Branch managers can delete products" on public.products;
create policy "Branch managers can delete products"
on public.products for delete to authenticated
using (
  public.current_staff_role() = 'admin'
  or (
    public.current_staff_role() = 'manager'
    and public.staff_can_access_branch(branch_id)
  )
);

grant delete on public.products to authenticated;
