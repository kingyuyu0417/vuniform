select
  p.id,
  p.school,
  p.name,
  coalesce(s->>'length', '') as length,
  coalesce(s->>'size', '') as size,
  bool_or(
    lower(coalesce(s->>'isTailored', 'false')) in ('true', '1')
    or trim(coalesce(s->>'size', '')) = '裁碼'
    or trim(coalesce(s->>'length', '')) ~ '^裁碼'
  ) as has_tailored_marker,
  count(*) as entries,
  count(distinct s->>'price') as distinct_prices,
  jsonb_agg(s order by s->>'isTailored', s->>'length', s->>'size') as entries_detail
from public.products p
cross join lateral jsonb_array_elements(coalesce(p.sizes, '[]'::jsonb)) s
group by p.id, p.school, p.name, coalesce(s->>'length', ''), coalesce(s->>'size', '')
having count(*) > 1
   and (
     count(distinct s->>'price') > 1
     or count(*) filter (
       where lower(coalesce(s->>'isTailored', 'false')) in ('true', '1')
         or trim(coalesce(s->>'size', '')) = '裁碼'
         or trim(coalesce(s->>'length', '')) ~ '^裁碼'
     ) > 0
   )
order by p.school, p.name, length, size;
