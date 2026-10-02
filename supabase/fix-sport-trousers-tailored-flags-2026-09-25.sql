begin;

create table if not exists public.product_tailored_flag_fix_backup_20260925 (
  backed_up_at timestamptz not null default now(),
  id text not null,
  school text,
  name text,
  sizes jsonb,
  branch_id text,
  display_order integer
);

insert into public.product_tailored_flag_fix_backup_20260925
  (id, school, name, sizes, branch_id, display_order)
select id, school, name, sizes, branch_id, display_order
from public.products
where id = 'az4xwh00'
  and not exists (
    select 1
    from public.product_tailored_flag_fix_backup_20260925 b
    where b.id = public.products.id
  );

update public.products p
set sizes = fixed.sizes
from (
  select
    id,
    jsonb_agg(
      case
        when elem->>'size' = '裁碼'
          then jsonb_set(elem, '{isTailored}', 'true'::jsonb, true)
        when elem->>'size' in ('1碼', '2碼', '3碼')
          then jsonb_set(elem, '{isTailored}', 'false'::jsonb, true)
        else elem
      end
      order by ordinality
    ) as sizes
  from public.products
  cross join lateral jsonb_array_elements(coalesce(products.sizes, '[]'::jsonb))
    with ordinality entries(elem, ordinality)
  where id = 'az4xwh00'
  group by id
) fixed
where p.id = fixed.id;

select
  p.id,
  p.school,
  p.name,
  p.sizes
from public.products p
where p.id = 'az4xwh00';

commit;
