alter table public.products add column if not exists gender text;

update public.products
set gender = case
  when name in ('藍／紫色短袖恤衫', '黑色短西褲', '男生長西褲', '男生黑色短襪（3對）') then 'boys'
  when name in ('藍／紫色連身校裙', '女生背心校裙', '女生黑色長襪') then 'girls'
  when name ~ '(男女生|男女通用|【男女生】)'
    or (name ~ '(男生|男裝|Boy[''’]s)' and name ~ '(女生|女裝|Girl[''’]s)')
    or (name !~ '(男生|男裝|Boy[''’]s|女生|女裝|Girl[''’]s)' and name ~ '運動')
    then 'unisex'
  when name ~ '(女生|女裝|Girl[''’]s)' then 'girls'
  when name ~ '(男生|男裝|Boy[''’]s)' then 'boys'
  else 'unisex'
end
where gender is null or gender not in ('boys', 'girls', 'unisex');

alter table public.products alter column gender set default 'unisex';
alter table public.products alter column gender set not null;

alter table public.products drop constraint if exists products_gender_check;
alter table public.products
  add constraint products_gender_check check (gender in ('boys', 'girls', 'unisex'));
