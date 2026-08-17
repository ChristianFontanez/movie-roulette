---
title: Architecture
type: reference
tags: [movie-roulette, architecture]
---

# Architecture

## Today — the web app (live)

```
Phone browser
   └─ GitHub Pages (static: index.html, app.js, styles.css)
        ├─ Supabase  ← players, movies, spins, app_config  (+ realtime)
        ├─ TMDB      ← search, posters, genres, providers, trailers
        └─ OMDb      ← IMDb rating, Rotten Tomatoes score, runtime
```

- No build step, no framework, no dependencies beyond `supabase-js` from a CDN.
  This is why it has been cheap to change so fast — protect that.
- Deploy is `git push` to `main`; Pages rebuilds in about a minute.
- Auth is a shared passphrase, hashed into `app_config`. See
  [[ADR 0002 Auth and RLS]] for why that's fine here and nowhere else.

## Target — mobile, alongside

```
iOS / Android (Expo)
   └─ Supabase project #2
        ├─ Auth (magic link, Apple, Google) + per-user RLS
        └─ Edge Function ──→ TMDB / OMDb   (keys server-side, cached)
```

## The isolation rule

**Mobile work must never be able to break Saturday night.**

| | Web | Mobile |
| --- | --- | --- |
| Repo | `movie-roulette` | `movie-roulette-mobile` |
| Hosting | GitHub Pages | App stores / TestFlight |
| Supabase project | current | new (see [[ADR 0002 Auth and RLS]]) |
| Auth | shared passphrase | real accounts |
| Movie API keys | in `config.js` | Edge Function only |

Shared: this roadmap, this vault, the issue tracker, and the data model's shape.
Not shared: code, deploys, databases, or release cycles.

### Why not one repo with two pipelines

Pages publishes from `main` root, so anything committed here is served publicly —
an Expo project in this repo would put its config files on the live site. The full
reasoning, and the three deployment paths this project ends up with, are in
[[ADR 0001 Mobile Stack]].

The temptation will be to "just point the mobile app at the existing database to
save time". Don't — that couples an experimental app to the one the group relies
on weekly, and forces the auth migration to happen under time pressure.

## Why the web app stays simple

It is the working product. Every dependency added to it is a thing that can break
on a Saturday. New complexity belongs on the mobile track, where nobody is waiting
on it.

Related: [[Data Model]] · [[ROADMAP]]
