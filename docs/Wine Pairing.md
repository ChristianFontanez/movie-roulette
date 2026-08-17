---
title: Wine Pairing
type: spec
tags: [movie-roulette, feature, wine]
milestone: unscheduled
status: waiting on content owner
---

# Wine Pairing

Pair a wine to whatever the wheel lands on, based on the movie's genre.

> [!important] Owned by someone else
> **The pairings themselves are not an engineering decision.** One of the group is
> the wine person and owns this list — the wine for each genre, and the line that
> goes with it, are his to write.
>
> **Status: parked** until that content exists. Nothing here should ship before
> then, and no placeholder pairings should be invented in the meantime — a wrong
> pour published under his name is worse than no feature.

## Why there's nothing to integrate

There is no free API that pairs wine to film genres, and the wine data APIs that
exist are paid or partner-only. This was checked, not assumed. So the feature is
**authored content plus a lookup** — which is exactly why the content owner is the
critical path, not the code.

## What the app already provides

The engineering side is genuinely small, and everything it needs is in place:

- TMDB returns genres per movie with no extra API call beyond the detail fetch
  already made. Verified: Interstellar comes back as
  `['Adventure', 'Drama', 'Science Fiction']`.
- The genre list is fixed and short, so the mapping can be **exhaustive** — no
  holes, no fallback logic needed.

## The worksheet

19 genres, the complete TMDB list. Two columns to fill in:

| Genre | Wine | The line |
| --- | --- | --- |
| Action | | |
| Adventure | | |
| Animation | | |
| Comedy | | |
| Crime | | |
| Documentary | | |
| Drama | | |
| Family | | |
| Fantasy | | |
| History | | |
| Horror | | |
| Music | | |
| Mystery | | |
| Romance | | |
| Science Fiction | | |
| TV Movie | | |
| Thriller | | |
| War | | |
| Western | | |

Two notes for whoever fills this in:

- **A style, not a bottle.** "Malbec" stays true forever; a specific label and
  vintage goes stale and gets impossible to buy.
- **Every genre needs an entry, including the awkward ones.** *Family* and
  *TV Movie* will come up, and a non-alcoholic answer is a perfectly good answer.

## Behaviour, once the content lands

- A movie has several genres — take the **first** TMDB genre so every phone shows
  the same pairing without extra state.
- Render under the ratings on the winner reveal: `🍷 <wine> — <line>`
- **Double features** get a pairing per movie. If two movies pair to the same
  wine, say so and pour one bottle.
- No genre data → no wine line. Never guess.

## Implementation sketch

Static mapping, so it ships as a plain object in the web app — no migration, no
table, nothing to sync. It becomes a shared module if the mobile app wants it too.

Only if the group starts wanting to *edit* pairings from inside the app does this
earn a database table. Don't start there.

## Later

- Per-movie override ("we're having beer")
- A non-alcoholic column throughout, so it isn't a wine-only feature
- Snack pairing — same shape of problem, probably more useful

Related: [[API Integrations]] · [[ROADMAP]]
