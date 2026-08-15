-- ============================================================
-- Movie Roulette — carry-over, streaming, runtime, notes,
-- and spin attribution.
-- Run this once: Supabase dashboard → SQL Editor → New query
--   → paste → Run.  Safe to re-run.
-- ============================================================

-- Extra detail we pull from OMDb / TMDB
alter table movies add column if not exists runtime   text;   -- "169 min"
alter table movies add column if not exists providers text;   -- "Hulu, Prime Video"

-- A short note someone can attach to their pick, so commentary
-- stops getting typed into the movie title
alter table movies add column if not exists note text;

-- Marks a movie that rolled over from a previous week
alter table movies add column if not exists carried_over boolean not null default false;

-- Who actually pressed spin
alter table spins add column if not exists spun_by_name text;
alter table spins add column if not exists spun_by_id   uuid references players(id) on delete set null;
