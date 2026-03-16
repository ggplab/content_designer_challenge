create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.member_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  challenge_name text not null unique,
  discord_user_id text unique,
  is_active boolean not null default true,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.challenge_members (
  id uuid primary key default gen_random_uuid(),
  challenge_name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.challenge_members (challenge_name)
values
  ('신지혜'),
  ('서영학'),
  ('박수빈'),
  ('송치오'),
  ('남희정'),
  ('신예린'),
  ('김한솔'),
  ('박정현'),
  ('정윤영'),
  ('임정'),
  ('강예정'),
  ('김희은'),
  ('지정수'),
  ('이인영'),
  ('이선정'),
  ('안예지'),
  ('김소진')
on conflict (challenge_name) do nothing;

create trigger set_member_profiles_updated_at
before update on public.member_profiles
for each row
execute function public.set_updated_at();

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes jsonb not null default '["submit:verify"]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);
create index if not exists api_keys_active_idx on public.api_keys(user_id, revoked_at, expires_at);

create table if not exists public.api_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  api_key_id uuid references public.api_keys(id) on delete set null,
  request_name text,
  ip_address text,
  origin text,
  user_agent text,
  status_code integer not null,
  error_code text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists api_audit_logs_user_id_created_at_idx
  on public.api_audit_logs(user_id, created_at desc);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.member_profiles
  where user_id = auth.uid();
$$;

alter table public.member_profiles enable row level security;
alter table public.challenge_members enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_audit_logs enable row level security;

create policy "challenge_members_select_authenticated"
on public.challenge_members
for select
using (auth.role() = 'authenticated');

create policy "member_profiles_select_own_or_admin"
on public.member_profiles
for select
using (
  auth.uid() = user_id
  or public.current_user_role() = 'admin'
);

create policy "member_profiles_insert_self_or_admin"
on public.member_profiles
for insert
with check (
  auth.uid() = user_id
  or public.current_user_role() = 'admin'
);

create policy "member_profiles_update_own_or_admin"
on public.member_profiles
for update
using (
  auth.uid() = user_id
  or public.current_user_role() = 'admin'
)
with check (
  auth.uid() = user_id
  or public.current_user_role() = 'admin'
);

create policy "api_keys_select_own_or_admin"
on public.api_keys
for select
using (
  auth.uid() = user_id
  or public.current_user_role() = 'admin'
);

create policy "api_keys_insert_own_or_admin"
on public.api_keys
for insert
with check (
  auth.uid() = user_id
  or public.current_user_role() = 'admin'
);

create policy "api_keys_update_own_or_admin"
on public.api_keys
for update
using (
  auth.uid() = user_id
  or public.current_user_role() = 'admin'
)
with check (
  auth.uid() = user_id
  or public.current_user_role() = 'admin'
);

create policy "api_audit_logs_select_own_or_admin"
on public.api_audit_logs
for select
using (
  auth.uid() = user_id
  or public.current_user_role() = 'admin'
);
