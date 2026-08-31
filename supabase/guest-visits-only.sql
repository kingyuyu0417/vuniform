create table if not exists public.guest_visits (
  id text primary key,
  queue_no text not null unique,
  queueNo text,
  guest_name text,
  guestName text,
  class_name text,
  className text,
  height_cm text,
  heightCm text,
  weight_kg text,
  weightKg text,
  phone text,
  notes text default '',
  status text not null default 'waiting',
  school text,
  created_at timestamptz not null default now(),
  createdAt timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists guest_visits_queue_no_idx on public.guest_visits(queue_no);
create index if not exists guest_visits_status_idx on public.guest_visits(status);
create index if not exists guest_visits_school_idx on public.guest_visits(school);

alter table public.guest_visits enable row level security;

drop policy if exists "Allow guest visit access" on public.guest_visits;
create policy "Allow guest visit access"
on public.guest_visits
for all
to anon
using (true)
with check (true);