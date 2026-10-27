create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

create index if not exists orders_branch_created_at_idx
  on public.orders (branch_id, created_at desc);
