---
title: ADR 0003 API Keys
type: adr
status: accepted
date: 2026-08-17
tags: [movie-roulette, adr, security]
---

# ADR 0003 — Movie API keys must move server-side

**Status:** accepted · **Date:** 2026-08-17

## Context

The web app calls TMDB and OMDb directly from the browser with both keys sitting
in `config.js`, committed to a public repo. That was a considered trade: the keys
are free, rate-limited per IP, and rotatable in a minute.

The calculus changes for mobile:

- **OMDb's free tier is 1,000 lookups/day for the whole key.** A key lifted from
  an app bundle and reused elsewhere doesn't just leak — it exhausts the group's
  quota and the app quietly stops showing ratings.
- Rotating a key in a shipped mobile app means an OTA update, not a `git push`.
- Store review increasingly frowns on credentials in bundles.

## Decision

The mobile app **never holds a movie API key.** Lookups go through a **Supabase
Edge Function** that holds `TMDB_API_KEY` and `OMDB_API_KEY` as secrets and
exposes exactly what the app needs:

```
GET  /movie-search?q=…        → title, year, poster, tmdb_id
GET  /movie-details?id=…      → ratings, runtime, providers, genres
```

The function is the only thing that knows about TMDB or OMDb. Benefits beyond
secrecy:

- Ratings and providers can be **cached** per movie, cutting OMDb calls to roughly
  one per distinct film ever — the 1,000/day ceiling stops mattering entirely
- Swapping providers (or adding a third) needs no client release
- One place to add rate limiting

## Consequences

- An Edge Function to write and deploy, which is new infrastructure for this
  project. Scoped as its own M3 issue.
- The **web app is deliberately left alone.** Its keys stay client-side. It's a
  private-link app where the current trade is still reasonable, and per
  [[ADR 0001 Mobile Stack]] the tracks stay isolated.
- Once the function exists and is proven, migrating the web app to use it is an
  easy, optional follow-up — and a good excuse to shrink `config.js` to just the
  Supabase values.

Related: [[ADR 0002 Auth and RLS]] · [[API Integrations]]
