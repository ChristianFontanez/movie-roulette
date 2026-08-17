-- ============================================================
-- Movie Roulette — multiple spins per night, and tracking which
-- movies were actually watched vs. passed over.
-- Run this once: Supabase dashboard → SQL Editor → New query
--   → paste → Run.  Safe to re-run.
-- ============================================================

-- 1. A movie night can involve several spins, so the old
--    "one spin per week" rule has to go. Done by lookup rather
--    than by name so it works whatever the constraint is called.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.spins'::regclass and contype = 'u'
  loop
    execute format('alter table spins drop constraint %I', c.conname);
  end loop;
end $$;

-- 2. What happened after each spin:
--    'pending'  → the wheel stopped, nobody has said yet
--    'watched'  → we watched it
--    'skipped'  → we passed and spun again
alter table spins add column if not exists outcome         text not null default 'pending';
alter table spins add column if not exists decided_by_name text;

-- 3. The same three states, tracked per movie. 'pending' movies
--    are the ones still on the wheel.
alter table movies add column if not exists status     text not null default 'pending';
alter table movies add column if not exists watched_at timestamptz;

-- 4. Backfill history: anything the wheel previously landed on was
--    watched, since that was the only outcome the app could record.
update movies m
   set status = 'watched', watched_at = s.created_at
  from spins s
 where s.winning_movie_id = m.id
   and m.status = 'pending';

update spins
   set outcome = 'watched'
 where outcome = 'pending'
   and winning_movie_id is not null;

-- 5. Keep the realtime feed working for the movies table.
--    (spins/movies/players were already added in schema.sql.)
