-- ============================================================
-- Movie Roulette — adds movie metadata (posters + ratings)
-- Run this once in your Supabase project:
--   Supabase dashboard → SQL Editor → New query → paste → Run
-- Safe to re-run; every statement is "if not exists".
-- ============================================================

-- Details we pull from TMDB when you pick a movie from search
alter table movies add column if not exists year        text;
alter table movies add column if not exists poster_url  text;
alter table movies add column if not exists tmdb_id     bigint;

-- Ratings we pull from OMDb (sourced from IMDb / Rotten Tomatoes)
alter table movies add column if not exists imdb_id     text;
alter table movies add column if not exists imdb_rating text;
alter table movies add column if not exists rt_score    text;

-- Denormalized on the spin so the winner still renders if the
-- movie row is later deleted
alter table spins  add column if not exists winning_poster_url text;
alter table spins  add column if not exists winning_year       text;
