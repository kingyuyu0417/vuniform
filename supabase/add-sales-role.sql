-- Run this once in the Supabase SQL Editor for existing deployments.
alter table public.staff_profiles drop constraint if exists staff_profiles_role_check;

alter table public.staff_profiles
  add constraint staff_profiles_role_check
  check (role in ('admin', 'manager', 'sales', 'staff'));
