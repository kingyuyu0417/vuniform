begin;

create table if not exists public.product_price_cleanup_backup_20260925 as
select p.id, p.school, p.branch_id, p.name, p.sizes, p.display_order
from public.products p
where p.id in (
  select id
  from (
    select p.id,
      s->>'size' as size,
      coalesce(s->>'length','') as length,
      count(*) as entries,
      count(distinct s->>'price') as prices
    from public.products p
    cross join lateral jsonb_array_elements(coalesce(p.sizes, '[]'::jsonb)) s
    group by p.id, s->>'size', coalesce(s->>'length','')
    having count(*) > 1 and count(distinct s->>'price') = 1
  ) safe_duplicates
);

with expanded as (
  select
    p.id,
    e.elem,
    e.ordinality,
    row_number() over (
      partition by p.id, e.elem->>'size', coalesce(e.elem->>'length','')
      order by e.ordinality
    ) as duplicate_rank
  from public.products p
  cross join lateral jsonb_array_elements(coalesce(p.sizes, '[]'::jsonb))
    with ordinality e(elem, ordinality)
), duplicate_stats as (
  select
    expanded.id,
    expanded.elem->>'size' as size,
    coalesce(expanded.elem->>'length','') as length,
    count(*) as entries,
    count(distinct expanded.elem->>'price') as prices
  from expanded
  group by expanded.id, expanded.elem->>'size', coalesce(expanded.elem->>'length','')
), rebuilt as (
  select expanded.id,
    jsonb_agg(elem order by ordinality)
      filter (where not (
        stats.entries > 1
        and stats.prices = 1
        and expanded.duplicate_rank > 1
      )) as sizes
  from expanded
  left join duplicate_stats stats
    on stats.id = expanded.id
    and stats.size = expanded.elem->>'size'
    and stats.length = coalesce(expanded.elem->>'length','')
  group by expanded.id
), updated as (
  update public.products p
  set sizes = rebuilt.sizes
  from rebuilt
  where p.id = rebuilt.id
    and p.sizes is distinct from rebuilt.sizes
  returning p.id
)
select count(*) as products_cleaned from updated;

commit;
