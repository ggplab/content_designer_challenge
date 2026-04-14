-- 롤백: drop table if exists public.short_links;
create table if not exists public.short_links (
  code         text        primary key,
  original_url text        not null,
  created_at   timestamptz not null default now()
);

alter table public.short_links enable row level security;
