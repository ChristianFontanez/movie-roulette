-- ============================================================
-- Movie Roulette — Supabase schema
-- Run this once in your Supabase project:
--   Supabase dashboard → SQL Editor → New query → paste → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- People in the group -----------------------------------------
create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- Movies added for a given week -------------------------------
create table if not exists movies (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  owner_id   uuid not null references players(id) on delete cascade,
  week_start date not null,                       -- Monday of the week
  created_at timestamptz not null default now()
);

-- One spin result per week ------------------------------------
create table if not exists spins (
  id               uuid primary key default gen_random_uuid(),
  week_start       date not null unique,          -- only one spin per week
  winning_movie_id uuid references movies(id) on delete set null,
  winner_player_id uuid references players(id) on delete set null,
  winning_title    text,                          -- denormalized for display
  winner_name      text,                          -- denormalized for display
  created_at       timestamptz not null default now()
);

-- Small key/value store (holds the group passphrase hash) -----
create table if not exists app_config (
  key   text primary key,
  value text
);

-- ============================================================
-- Row Level Security
-- This is a small private friends app, gated by a shared
-- passphrase in the UI. We allow the anon (public) key full
-- access to these tables. The anon key is safe to ship in the
-- frontend; these policies scope it to only this app's tables.
-- ============================================================
alter table players    enable row level security;
alter table movies     enable row level security;
alter table spins      enable row level security;
alter table app_config enable row level security;

drop policy if exists "anon all players"    on players;
drop policy if exists "anon all movies"     on movies;
drop policy if exists "anon all spins"      on spins;
drop policy if exists "anon all app_config" on app_config;

create policy "anon all players"    on players    for all to anon using (true) with check (true);
create policy "anon all movies"     on movies     for all to anon using (true) with check (true);
create policy "anon all spins"      on spins      for all to anon using (true) with check (true);
create policy "anon all app_config" on app_config for all to anon using (true) with check (true);

-- ============================================================
-- Real-time: broadcast changes so every phone stays in sync
-- ============================================================
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table movies;
alter publication supabase_realtime add table spins;
