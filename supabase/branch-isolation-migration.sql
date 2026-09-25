-- Branch-scoped staff and school access. Run after secure-migration.sql.

create table if not exists public.branches (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.school_branches (
  school text primary key,
  branch_id text not null references public.branches(id) on delete restrict,
  created_at timestamptz not null default now()
);

insert into public.branches (id, name)
values
  ('sheung-wan', '上環分店'),
  ('fortress-hill', '炮台山分店'),
  ('prince-edward', '太子分店'),
  ('rainbow', '彩虹分店'),
  ('kowloon-city', '九龍城分店'),
  ('tsuen-wan', '荃灣分店'),
  ('tai-po', '大埔分店'),
  ('yuen-long', '元朗分店'),
  ('tuen-mun-butterfly', '屯門（蝴蝶）分店'),
  ('tuen-mun-ming-kam', '屯門（鳴琴）分店'),
  ('sha-tin', '沙田分店')
on conflict (id) do update set name = excluded.name;

alter table public.staff_profiles add column if not exists branch_id text references public.branches(id);
alter table public.products add column if not exists branch_id text references public.branches(id);
alter table public.orders add column if not exists branch_id text references public.branches(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_profiles_branch_id_fkey') then
    alter table public.staff_profiles add constraint staff_profiles_branch_id_fkey foreign key (branch_id) references public.branches(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_branch_id_fkey') then
    alter table public.products add constraint products_branch_id_fkey foreign key (branch_id) references public.branches(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_branch_id_fkey') then
    alter table public.orders add constraint orders_branch_id_fkey foreign key (branch_id) references public.branches(id);
  end if;
end
$$;

-- Recover mappings when school-meta already stores outletName.
insert into public.school_branches (school, branch_id)
select entry.key, branch.id
from public.app_storage storage
cross join lateral jsonb_each(storage.value::jsonb) entry
join public.branches branch on branch.name = entry.value->>'outletName'
where storage.key = 'school-meta'
on conflict (school) do update set branch_id = excluded.branch_id;

update public.products product
set branch_id = mapping.branch_id
from public.school_branches mapping
where mapping.school = product.school
  and product.branch_id is null;

update public.orders order_record
set branch_id = mapping.branch_id
from public.school_branches mapping
where mapping.school = order_record.school
  and order_record.branch_id is null;

create or replace function public.assign_order_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null then
    select branch_id into new.branch_id
    from public.staff_profiles
    where id = new.cashier_id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_branch on public.orders;
create trigger orders_assign_branch
before insert on public.orders
for each row execute function public.assign_order_branch();

create or replace function public.current_staff_branch_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from public.staff_profiles where id = auth.uid();
$$;

alter table public.branches enable row level security;
alter table public.school_branches enable row level security;

drop policy if exists "Authenticated staff can read branches" on public.branches;
create policy "Authenticated staff can read branches"
on public.branches for select
to authenticated
using (public.current_staff_role() = 'admin' or id = public.current_staff_branch_id());

drop policy if exists "Admins can manage branches" on public.branches;
create policy "Admins can manage branches"
on public.branches for all
to authenticated
using (public.current_staff_role() = 'admin')
with check (public.current_staff_role() = 'admin');

drop policy if exists "Authenticated staff can read assigned schools" on public.school_branches;
create policy "Authenticated staff can read assigned schools"
on public.school_branches for select
to authenticated
using (public.current_staff_role() = 'admin' or branch_id = public.current_staff_branch_id());

drop policy if exists "Admins can manage assigned schools" on public.school_branches;
create policy "Admins can manage assigned schools"
on public.school_branches for all
to authenticated
using (public.current_staff_role() = 'admin')
with check (public.current_staff_role() = 'admin');

drop policy if exists "Authenticated staff can read products" on public.products;
create policy "Authenticated staff can read products"
on public.products for select
to authenticated
using (public.current_staff_role() = 'admin' or branch_id = public.current_staff_branch_id());

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
on public.products for all
to authenticated
using (public.current_staff_role() = 'admin')
with check (public.current_staff_role() = 'admin');

drop policy if exists "Staff can read orders" on public.orders;
create policy "Staff can read orders"
on public.orders for select
to authenticated
using (public.current_staff_role() = 'admin' or branch_id = public.current_staff_branch_id());

drop policy if exists "Staff can create orders" on public.orders;
create policy "Staff can create orders"
on public.orders for insert
to authenticated
with check (
  cashier_id = auth.uid()
  and (public.current_staff_role() = 'admin' or branch_id = public.current_staff_branch_id())
);

drop policy if exists "Staff can read order items" on public.order_items;
create policy "Staff can read order items"
on public.order_items for select
to authenticated
using (exists (
  select 1 from public.orders order_record
  where order_record.id = order_items.order_id
    and (public.current_staff_role() = 'admin' or order_record.branch_id = public.current_staff_branch_id())
));
