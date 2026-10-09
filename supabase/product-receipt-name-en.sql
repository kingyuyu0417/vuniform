alter table public.products
  add column if not exists receipt_name_en text not null default '';

alter table public.order_items
  add column if not exists receipt_name_en text not null default '';
