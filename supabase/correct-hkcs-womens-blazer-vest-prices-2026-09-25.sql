begin;

create table if not exists public.product_price_correction_backup_20260925 (
  backed_up_at timestamptz not null default now(),
  id text not null,
  school text,
  name text,
  sizes jsonb,
  branch_id text,
  display_order integer
);

insert into public.product_price_correction_backup_20260925
  (id, school, name, sizes, branch_id, display_order)
select id, school, name, sizes, branch_id, display_order
from public.products
where school = '港青基信書院'
  and name = '女裝西裝褸配背心'
  and not exists (
    select 1
    from public.product_price_correction_backup_20260925 b
    where b.id = public.products.id
  );

update public.products
set sizes = jsonb_build_array(
  jsonb_build_object('size', '32', 'price', 434, 'length', '', 'isTailored', false),
  jsonb_build_object('size', '34', 'price', 449, 'length', '', 'isTailored', false),
  jsonb_build_object('size', '36', 'price', 464, 'length', '', 'isTailored', false),
  jsonb_build_object('size', '38', 'price', 484, 'length', '', 'isTailored', false),
  jsonb_build_object('size', '40', 'price', 504, 'length', '', 'isTailored', false),
  jsonb_build_object('size', '42', 'price', 524, 'length', '', 'isTailored', false),
  jsonb_build_object('size', '44', 'price', 549, 'length', '', 'isTailored', false),
  jsonb_build_object('size', '裁碼', 'price', 589, 'length', '', 'isTailored', true)
)
where school = '港青基信書院'
  and name = '女裝西裝褸配背心';

select id, school, name, sizes
from public.products
where school = '港青基信書院'
  and name = '女裝西裝褸配背心';

commit;
