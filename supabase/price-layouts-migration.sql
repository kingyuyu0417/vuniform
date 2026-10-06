-- Run after secure-migration.sql, which defines public.current_staff_role().
create table if not exists public.price_layouts (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  sheet text not null,
  season text not null default '',
  config jsonb not null,
  verified boolean not null default false,
  source text not null default 'confirmed-generic-import',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_layouts_school_sheet_unique unique (school, sheet),
  constraint price_layouts_identity_not_empty check (length(trim(school)) > 0 and length(trim(sheet)) > 0),
  constraint price_layouts_config_object check (jsonb_typeof(config) = 'object'),
  constraint price_layouts_config_identity check (
    coalesce(config ->> 'school', '') = school
    and coalesce(config ->> 'sheet', '') = sheet
    and length(coalesce(config ->> 'signature', '')) > 0
    and case
      when jsonb_typeof(config -> 'blocks') = 'array'
      then jsonb_array_length(config -> 'blocks') > 0
      else false
    end
  )
);

alter table public.price_layouts enable row level security;

drop policy if exists "Authenticated staff can read price layouts" on public.price_layouts;
create policy "Authenticated staff can read price layouts"
on public.price_layouts
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Admins can manage price layouts" on public.price_layouts;
create policy "Admins can manage price layouts"
on public.price_layouts
for all
to authenticated
using (public.current_staff_role() = 'admin')
with check (public.current_staff_role() = 'admin' and verified = true);

grant select, insert, update, delete on public.price_layouts to authenticated;
