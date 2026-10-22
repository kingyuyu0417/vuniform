alter table public.products
  add column if not exists season text not null default '',
  add column if not exists category text not null default '',
  add column if not exists style text not null default '';
