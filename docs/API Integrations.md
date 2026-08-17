---
title: API Integrations
type: reference
tags: [movie-roulette, api]
---

# API Integrations

What's wired up, what's available, and what to stop looking for. Everything marked
**verified** was tested against the live keys on 2026-08-17.

## Wired up

| Source | Used for | Notes |
| --- | --- | --- |
| **TMDB** | search, posters, year, genres, streaming providers | Free, no paid tier, ~40 req/s. Attribution required (in the footer). |
| **OMDb** | IMDb rating, Rotten Tomatoes score, runtime | **1,000 lookups/day, whole key.** Emailed keys need activating. |
| **Supabase** | data + realtime sync | Free tier |

### Search behaviour, measured

TMDB matches words anywhere in a title — "wong foo" finds *To Wong Foo*, "soul of
the dragon" finds *Batman: Soul of the Dragon*. It does **not** handle
misspellings: "intersteller" returns nothing. Neither does OMDb, so the fallback
doesn't rescue typos — it's there for outages and gaps. Hand-typed titles are
looked up by name via OMDb `?t=`, which is how they still get posters.

## Available, not yet used — all verified

| Capability | Endpoint | Worth it? |
| --- | --- | --- |
| **Trailers** | `/movie/{id}/videos` | Yes — 5 YouTube trailers for Interstellar. Cheap, high delight. M2. |
| **Genres** | in `/movie/{id}` | Yes — powers [[Wine Pairing]]. Already returned. |
| **Watch deep link** | `link` in `/watch/providers` | Yes — a "where to watch" button. M2. |
| **Cast** | `/movie/{id}/credits` | Maybe — nice on a detail screen, noise in a list. |
| **Content rating** | `/movie/{id}/release_dates` | Maybe — useful if kids are ever in the room. |
| **Recommendations** | `/movie/{id}/recommendations` | Interesting — "you liked X, add Y?" as an add-movie suggestion. |

## Don't bother

| Thing | Why not |
| --- | --- |
| **IMDb official API** | No free tier. Enterprise pricing via AWS Data Exchange. OMDb is the practical route to IMDb ratings. |
| **Rotten Tomatoes API** | No public access; partner-only. OMDb surfaces RT scores, which is the only realistic path. |
| **Letterboxd API** | No public API. Deep links by slug are the ceiling. |
| **JustWatch API** | No public API — but TMDB's provider `link` is JustWatch-backed, so we already have the useful part. |
| **Wine pairing APIs** | Don't exist for this. Wine data APIs are paid/partner. See [[Wine Pairing]] — this is authored content. |

## Rules

1. **Ratings are decoration.** Every lookup is wrapped so failure leaves fields
   blank instead of blocking an add. Keep it that way.
2. **Cache anything from OMDb.** The daily ceiling is the real constraint, and a
   film's runtime never changes. See [[ADR 0003 API Keys]].
3. **Never let a movie API sit between a user and adding a movie.** Insert first,
   enrich after — that's why adds feel instant today.
4. **Mobile gets no keys.** See [[ADR 0003 API Keys]].

Related: [[Wine Pairing]] · [[ROADMAP]]
