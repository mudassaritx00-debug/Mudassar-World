-- Mudassar Private Portfolio
-- Run this in Supabase SQL Editor.
-- Then create your account and manually mark YOUR profile as admin.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.access_requests enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "requests own insert" on public.access_requests;
create policy "requests own insert"
on public.access_requests for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "requests own read" on public.access_requests;
create policy "requests own read"
on public.access_requests for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin update requests" on public.access_requests;
create policy "admin update requests"
on public.access_requests for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin delete requests" on public.access_requests;
create policy "admin delete requests"
on public.access_requests for delete
to authenticated
using (public.is_admin());

-- Automatically create a profile whenever a new Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- AFTER you create your own account, find its email and run:
-- update public.profiles set is_admin = true where id = 'YOUR-USER-UUID';
-- Never make visitor accounts admin.
