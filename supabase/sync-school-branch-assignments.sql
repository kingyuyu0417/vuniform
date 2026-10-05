create or replace function public.sync_school_branch_assignments()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.school_branches (school, branch_id)
  select metadata.key, branches.id
  from public.app_storage storage
  cross join lateral jsonb_each(storage.value::jsonb) metadata
  join public.branches
    on branches.name = metadata.value ->> 'outletName'
  where storage.key = 'school-meta'
  on conflict (school) do update
    set branch_id = excluded.branch_id;

  update public.products
  set branch_id = school_branches.branch_id
  from public.school_branches
  where school_branches.school = products.school
    and products.branch_id is distinct from school_branches.branch_id;
end;
$$;

create or replace function public.sync_school_branch_assignments_after_storage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.key = 'school-meta' then
    perform public.sync_school_branch_assignments();
  end if;
  return new;
end;
$$;

drop trigger if exists app_storage_sync_school_branch_assignments on public.app_storage;
create trigger app_storage_sync_school_branch_assignments
after insert or update of value on public.app_storage
for each row
when (new.key = 'school-meta')
execute function public.sync_school_branch_assignments_after_storage_change();

select public.sync_school_branch_assignments();

revoke all on function public.sync_school_branch_assignments() from public, anon, authenticated;
revoke all on function public.sync_school_branch_assignments_after_storage_change() from public, anon, authenticated;
