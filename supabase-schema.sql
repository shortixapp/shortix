-- Shortix database schema (PostgreSQL / Supabase)
-- Run this in the Supabase SQL editor once your project is created.
-- Re-running is safe (idempotent) due to IF NOT EXISTS / OR REPLACE.

create extension if not exists "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

-- ─── Links ────────────────────────────────────────────────────────────
create table if not exists links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  -- Temporary anonymous identity (IP-based), removed once auth is fully wired.
  client_id text,
  slug text unique not null,
  url text not null,
  clicks integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_links_slug    on links(slug);
create index if not exists idx_links_user    on links(user_id);
create index if not exists idx_links_client  on links(client_id);

-- ─── Clicks (analytics) ───────────────────────────────────────────────
create table if not exists clicks (
  id bigserial primary key,
  link_id uuid references links(id) on delete cascade,
  country text,
  device text,
  browser text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clicks_link    on clicks(link_id);
create index if not exists idx_clicks_created on clicks(created_at);

-- ─── API Keys (Pro plan) ──────────────────────────────────────────────
create table if not exists api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  -- Store only the hash (SHA-256) — never the plaintext key
  key_hash text not null unique,
  -- Display prefix for UI (e.g. "sx_live_AbCdEf…") — safe to show
  key_prefix text not null,
  label text,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_user on api_keys(user_id);
create index if not exists idx_api_keys_hash on api_keys(key_hash);

-- ─── Atomic click counter ─────────────────────────────────────────────
-- Called from redirect.js via supabase.rpc('increment_clicks', { link_id })
create or replace function increment_clicks(link_id uuid)
returns void
language sql
security definer
as $$
  update links set clicks = clicks + 1 where id = link_id;
$$;

-- ─── Row Level Security ───────────────────────────────────────────────
-- The front-end never talks to Supabase directly — only through
-- Netlify Functions which use the service role key (bypasses RLS).
-- Enable RLS for defence-in-depth in case the anon key leaks.

alter table users   enable row level security;
alter table links   enable row level security;
alter table clicks  enable row level security;
alter table api_keys enable row level security;

-- Users can read/update their own row (for future dashboard profile page)
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'users_self' and tablename = 'users') then
    create policy users_self on users
      for all using (auth.uid() = id);
  end if;
end $$;

-- Users can read their own links and stats (for future direct Supabase queries)
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'links_owner' and tablename = 'links') then
    create policy links_owner on links
      for all using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'clicks_owner' and tablename = 'clicks') then
    create policy clicks_owner on clicks
      for select using (
        link_id in (select id from links where user_id = auth.uid())
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'api_keys_owner' and tablename = 'api_keys') then
    create policy api_keys_owner on api_keys
      for all using (auth.uid() = user_id);
  end if;
end $$;
