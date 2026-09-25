create table if not exists public.branches (
  id text primary key,
  name text not null unique,
  address text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.branches (id, name, address, phone)
values
  ('sheung-wan', '上環分店', '上環文咸東街79-85號文咸中心8樓全層（近上環港鐵站A2出口）', '2815 2673'),
  ('fortress-hill', '炮台山分店', '炮台山屈臣道4-6號海景大廈B座14樓1403B室（近炮台山港鐵站A出口）', '2802 6887'),
  ('prince-edward', '太子分店', '太子長沙灣道恒滿樓38號地舖（近太子港鐵站A／D／E出口）', '3188 9762'),
  ('rainbow', '彩虹分店', '九龍彩虹邨青楊路金碧樓32號地舖（近彩虹港鐵站C4出口）', '2321 1733'),
  ('kowloon-city', '九龍城分店', '九龍城城南道3號地舖（近宋皇臺港鐵站B2／B3出口）', '2382 2407'),
  ('tsuen-wan', '荃灣分店', '荃灣福來邨海壩街永嘉樓9號地舖（近荃灣港鐵站A出口）', '2437 9997'),
  ('tai-po', '大埔分店', '大埔大元邨泰榮樓3號地舖（近大埔廣場對面）', '2662 3819'),
  ('yuen-long', '元朗分店', '元朗媽橫路51-53號褔順樓6號地舖（近西鐵朗屏站B2出口）', '2321 9282'),
  ('tuen-mun-butterfly', '屯門（蝴蝶）分店', '屯門湖翠路1號蝴蝶邨蝴蝶廣場R165號地舖', '2404 0177'),
  ('tuen-mun-ming-kum', '屯門（鳴琴）分店', '屯門建群街3號永發工業大廈4樓B室（近輕鐵鳴琴站／建安站）', '3691 9897'),
  ('sha-tin', '沙田分店', '沙田石門安群街3號京瑞廣場一期5樓A室（近屯馬線石門站C出口）', '2637 3313')
on conflict (id) do update set name = excluded.name, address = excluded.address, phone = excluded.phone;

alter table public.staff_profiles add column if not exists branch_id text references public.branches(id);
alter table public.products add column if not exists branch_id text references public.branches(id);
alter table public.orders add column if not exists branch_id text references public.branches(id);

create table if not exists public.school_branches (
  school text primary key,
  branch_id text not null references public.branches(id),
  created_at timestamptz not null default now()
);

insert into public.school_branches (school, branch_id)
select school, b.id
from public.products p
join public.branches b on b.name = (
  select meta.value ->> 'outletName'
  from public.app_storage s
  cross join lateral jsonb_each(s.value::jsonb) meta
  where s.key = 'school-meta' and meta.key = p.school
)
where coalesce(school, '') <> ''
on conflict (school) do update set branch_id = excluded.branch_id;

update public.products p
set branch_id = sb.branch_id
from public.school_branches sb
where sb.school = p.school and p.branch_id is distinct from sb.branch_id;

update public.orders o
set branch_id = sb.branch_id
from public.school_branches sb
where sb.school = o.school and o.branch_id is distinct from sb.branch_id;

create or replace function public.current_staff_branch_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from public.staff_profiles where id = auth.uid();
$$;

create or replace function public.staff_can_access_branch(target_branch_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_role() = 'admin'
    or (target_branch_id is not null and target_branch_id = public.current_staff_branch_id());
$$;

create or replace function public.set_product_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null then
    select branch_id into new.branch_id from public.school_branches where school = new.school;
  end if;
  return new;
end;
$$;

drop trigger if exists products_set_branch on public.products;
create trigger products_set_branch
before insert or update of school, branch_id on public.products
for each row execute function public.set_product_branch();

create or replace function public.set_order_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null then
    select branch_id into new.branch_id from public.school_branches where school = new.school;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_branch on public.orders;
create trigger orders_set_branch
before insert or update of school, branch_id on public.orders
for each row execute function public.set_order_branch();

alter table public.branches enable row level security;
alter table public.school_branches enable row level security;

drop policy if exists "Authenticated staff can read branches" on public.branches;
create policy "Authenticated staff can read branches"
on public.branches for select to authenticated
using (active and public.staff_can_access_branch(id));

drop policy if exists "Authenticated staff can read assigned schools" on public.school_branches;
create policy "Authenticated staff can read assigned schools"
on public.school_branches for select to authenticated
using (public.staff_can_access_branch(branch_id));

drop policy if exists "Staff can read own profile" on public.staff_profiles;
drop policy if exists "Branch staff can read own profile" on public.staff_profiles;
create policy "Branch staff can read own profile"
on public.staff_profiles for select to authenticated
using (id = auth.uid() or public.current_staff_role() = 'admin');

drop policy if exists "Authenticated staff can read products" on public.products;
drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Managers can edit products" on public.products;
drop policy if exists "Branch staff can read products" on public.products;
create policy "Branch staff can read products"
on public.products for select to authenticated
using (public.staff_can_access_branch(branch_id));

drop policy if exists "Branch managers can edit products" on public.products;
create policy "Branch managers can edit products"
on public.products for update to authenticated
using (public.current_staff_role() = 'admin' or (public.current_staff_role() = 'manager' and public.staff_can_access_branch(branch_id)))
with check (public.current_staff_role() = 'admin' or (public.current_staff_role() = 'manager' and public.staff_can_access_branch(branch_id)));

drop policy if exists "Authenticated staff can read orders" on public.orders;
drop policy if exists "Staff can create own orders" on public.orders;
drop policy if exists "Authenticated staff can write orders" on public.orders;
drop policy if exists "Authenticated staff can update orders" on public.orders;
drop policy if exists "Branch staff can read orders" on public.orders;
create policy "Branch staff can read orders"
on public.orders for select to authenticated
using (public.staff_can_access_branch(branch_id) and (public.current_staff_role() in ('admin', 'manager') or cashier_id = auth.uid()));

drop policy if exists "Branch staff can create orders" on public.orders;
create policy "Branch staff can create orders"
on public.orders for insert to authenticated
with check (cashier_id = auth.uid() and public.staff_can_access_branch(branch_id));

drop policy if exists "Authenticated staff can read order items" on public.order_items;
drop policy if exists "Authenticated staff can write order items" on public.order_items;
drop policy if exists "Authenticated staff can update order items" on public.order_items;
drop policy if exists "Staff can create order items" on public.order_items;
create policy "Branch staff can read order items"
on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and public.staff_can_access_branch(o.branch_id)
    and (public.current_staff_role() in ('admin', 'manager') or o.cashier_id = auth.uid())
));

create policy "Branch staff can create order items"
on public.order_items for insert to authenticated
with check (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
    and o.cashier_id = auth.uid()
    and public.staff_can_access_branch(o.branch_id)
));

grant select on public.branches, public.school_branches to authenticated;
grant select on public.staff_profiles, public.products, public.orders to authenticated;