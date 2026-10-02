begin;

create table if not exists public.product_sizes_clear_backup_20260925 (
  backed_up_at timestamptz not null default now(),
  id text not null,
  school text,
  name text,
  sizes jsonb,
  branch_id text,
  display_order integer
);

insert into public.product_sizes_clear_backup_20260925
  (id, school, name, sizes, branch_id, display_order)
select id, school, name, sizes, branch_id, display_order
from public.products
where id in (
  'dede-1fa6e49fc50740c090fe97a1e1973458',
  'dede-3aeb11e3f6984a9d89913b71921f36e7',
  'dede-5deeb8733fab43d18e6aff5ee7831638',
  'dede-785492d8a6c24f6e9404076f073746bb',
  'dede-7c4769bfaa174517842e042f9cced57c',
  'dede-84c86ebaf5b048758dce036852ad2bd3',
  'dede-8c381869211f4cfdb9a7af4e79e2927c',
  'dede-92ade1f80c4740c3be8ba08c1430c594',
  'dede-94e2e18cb607468f8951bca9e7965233',
  'dede-b704b259c71549f4bd853c83cee30628',
  'dede-c2d01e386ad44f2c9c7cb62f372672fa',
  'dede-d5b339bbf8f04854aa7776517fa5d2c5',
  'dede-d61408174b524a58beb809138f629fd6',
  'dede-dfcdea7e88b6430a81248e2eb8bf5cd5',
  'dede-e104a680782c4c67bd5d8a1295e0d088',
  'dede-e33ee3d2875b4b5caf2898ecd8c187c4',
  'dede-e77f5d564ab1412ea3e0b3e727004e1f',
  'dede-eeb3eb4636034e3293f0687b51ad2e04',
  'dede-f034a4207c6348c8b32eb84b1cc6fc58'
)
and not exists (
  select 1
  from public.product_sizes_clear_backup_20260925 b
  where b.id = public.products.id
);

update public.products
set sizes = '[]'::jsonb
where id in (
  'dede-1fa6e49fc50740c090fe97a1e1973458',
  'dede-3aeb11e3f6984a9d89913b71921f36e7',
  'dede-5deeb8733fab43d18e6aff5ee7831638',
  'dede-785492d8a6c24f6e9404076f073746bb',
  'dede-7c4769bfaa174517842e042f9cced57c',
  'dede-84c86ebaf5b048758dce036852ad2bd3',
  'dede-8c381869211f4cfdb9a7af4e79e2927c',
  'dede-92ade1f80c4740c3be8ba08c1430c594',
  'dede-94e2e18cb607468f8951bca9e7965233',
  'dede-b704b259c71549f4bd853c83cee30628',
  'dede-c2d01e386ad44f2c9c7cb62f372672fa',
  'dede-d5b339bbf8f04854aa7776517fa5d2c5',
  'dede-d61408174b524a58beb809138f629fd6',
  'dede-dfcdea7e88b6430a81248e2eb8bf5cd5',
  'dede-e104a680782c4c67bd5d8a1295e0d088',
  'dede-e33ee3d2875b4b5caf2898ecd8c187c4',
  'dede-e77f5d564ab1412ea3e0b3e727004e1f',
  'dede-eeb3eb4636034e3293f0687b51ad2e04',
  'dede-f034a4207c6348c8b32eb84b1cc6fc58'
);

select count(*) as cleared_products
from public.products
where id in (
  'dede-1fa6e49fc50740c090fe97a1e1973458',
  'dede-3aeb11e3f6984a9d89913b71921f36e7',
  'dede-5deeb8733fab43d18e6aff5ee7831638',
  'dede-785492d8a6c24f6e9404076f073746bb',
  'dede-7c4769bfaa174517842e042f9cced57c',
  'dede-84c86ebaf5b048758dce036852ad2bd3',
  'dede-8c381869211f4cfdb9a7af4e79e2927c',
  'dede-92ade1f80c4740c3be8ba08c1430c594',
  'dede-94e2e18cb607468f8951bca9e7965233',
  'dede-b704b259c71549f4bd853c83cee30628',
  'dede-c2d01e386ad44f2c9c7cb62f372672fa',
  'dede-d5b339bbf8f04854aa7776517fa5d2c5',
  'dede-d61408174b524a58beb809138f629fd6',
  'dede-dfcdea7e88b6430a81248e2eb8bf5cd5',
  'dede-e104a680782c4c67bd5d8a1295e0d088',
  'dede-e33ee3d2875b4b5caf2898ecd8c187c4',
  'dede-e77f5d564ab1412ea3e0b3e727004e1f',
  'dede-eeb3eb4636034e3293f0687b51ad2e04',
  'dede-f034a4207c6348c8b32eb84b1cc6fc58'
)
and sizes = '[]'::jsonb;

commit;
