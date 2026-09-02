-- Enable realtime updates for the shared customer order workflow.
-- Safe to run repeatedly in the Supabase SQL Editor.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_orders'
  ) then
    alter publication supabase_realtime add table public.customer_orders;
  end if;
end
$$;

alter table public.customer_orders replica identity full;
