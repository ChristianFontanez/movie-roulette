---
title: Data Model
type: reference
tags: [movie-roulette, data]
---

# Data Model

Current schema for the live web app. Migrations are the `schema*.sql` files in the
repo root, applied in order.

## players

| Column | Notes |
| --- | --- |
| `id` | uuid |
| `name` | unique; friends pick or create one, stored per device |

Deleting a player **cascades to their movies** — the People admin in the ⚙️ menu
warns with a count before doing it.

## movies

One row per movie per week. Re-adding next week creates a new row on purpose, so
each week's wheel is a historical record.

| Column | Notes |
| --- | --- |
| `title`, `owner_id`, `week_start` | the essentials; `week_start` is that week's Monday |
| `year`, `poster_url`, `tmdb_id`, `imdb_id` | from TMDB (or OMDb fallback) |
| `imdb_rating`, `rt_score`, `runtime` | from OMDb |
| `providers` | comma-joined streaming names, US region |
| `note` | free text, 140 chars, tap a row to edit |
| `carried_over` | true if it rolled over from last week |
| **`status`** | `pending` · `watched` · `skipped` |
| `watched_at` | set when marked watched |

### status is the important one

- `pending` — on the wheel
- `watched` — actually watched; leaves the wheel, does **not** carry over
- `skipped` — the wheel landed on it and the group passed; leaves the wheel for
  the week but **does** carry over, because it was never watched

This exists because a movie night involves several spins and the wheel landing on
something is not the same as watching it.

## spins

Append-only log. **Multiple rows per week** — the original one-per-week unique
constraint was dropped in `schema-update-3.sql`.

| Column | Notes |
| --- | --- |
| `week_start` | no longer unique |
| `winning_movie_id` | what it landed on |
| `winning_title`, `winning_year`, `winning_poster_url`, `winner_name` | denormalised so history survives a deleted movie |
| `spun_by_id`, `spun_by_name` | who pressed the button |
| **`outcome`** | `pending` · `watched` · `skipped` |
| `decided_by_name` | who answered "are we watching it?" |

`outcome = pending` is what makes the app ask for a verdict before allowing
another spin.

## app_config

Key/value. Holds `passphrase_hash`, and one `carried_<week>` key per week that
acts as a mutex so several phones opening on a Monday can't duplicate the
carry-over. The primary key does the locking — first insert wins, everyone else
gets a 409 and backs off.

## Coming

- `feature_requests` — see [[Feature Requests]]
- `group_members` — see [[Group Codes]]
- genre storage for [[Wine Pairing]] (TMDB returns genres already; only needs
  persisting if pairings should work offline)

Related: [[Architecture]] · [[ADR 0002 Auth and RLS]]
