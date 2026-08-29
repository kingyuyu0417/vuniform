create table if not exists public.app_storage (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_storage enable row level security;

drop policy if exists "Allow POS app storage access" on public.app_storage;

create policy "Allow POS app storage access"
on public.app_storage
for all
to anon
using (true)
with check (true);