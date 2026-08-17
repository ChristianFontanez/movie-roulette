---
title: Wine Pairing
type: spec
tags: [movie-roulette, feature, wine]
milestone: web-1.1
---

# Wine Pairing

Pair a wine to whatever the wheel lands on, based on the movie's genre.

## The honest constraint

There is **no free API that pairs wine to film genres**, and the wine data APIs
that exist are paid or partner-only. So this is *authored content*: a mapping we
write once, keyed on the genres TMDB already gives us for free.

That's a feature, not a limitation — a hand-written pairing with a bit of
personality beats anything a generic API would return.

## What we already have

TMDB returns genres per movie with no extra call beyond the detail fetch. Verified
against the live key — Interstellar comes back as
`['Adventure', 'Drama', 'Science Fiction']`.

The full genre list is fixed and small (19 entries), so the mapping can be
exhaustive rather than a lookup with holes:

> Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family,
> Fantasy, History, Horror, Music, Mystery, Romance, Science Fiction, TV Movie,
> Thriller, War, Western

## Starter mapping

First pass — argue with it, that's the point. Each entry needs a wine style (not
a specific bottle, which would go stale) and a one-line reason with some voice.

| Genre | Wine style | The line |
| --- | --- | --- |
| Action | Zinfandel | Big, loud, a little too much alcohol. Obviously. |
| Adventure | Malbec | Dusty and open-road, drinks like a long way from home. |
| Animation | Prosecco | Bubbles. It's a cartoon. Don't overthink it. |
| Comedy | Vinho Verde | Light, spritzy, faintly ridiculous — refills itself. |
| Crime | Barolo | Structured, brooding, takes its time revealing the plot. |
| Documentary | Dry Riesling | Precise, a bit austere, makes you pay attention. |
| Drama | Pinot Noir | Thin-skinned and emotionally complicated. |
| Family | Sparkling grape juice | Everyone gets a glass, nobody gets a headache. |
| Fantasy | Orange wine | Ancient method, tastes like nothing else on the table. |
| History | Rioja Gran Reserva | Aged for a decade before anyone was allowed near it. |
| Horror | Nero d'Avola | Volcanic, blood-dark, unsettling right up front. |
| Music | Champagne | Made to be opened loudly in company. |
| Mystery | Chenin Blanc | You will not guess what's in it until the last act. |
| Romance | Provence rosé | Pink, unserious, entirely sincere about it. |
| Science Fiction | Grüner Veltliner | Clean, mineral, tastes faintly of the future. |
| TV Movie | Boxed red | Look, we all know what this is. |
| Thriller | Syrah | Smoked meat and black pepper, tension in the glass. |
| War | Bordeaux blend | Sombre, tannic, built to outlive everyone in it. |
| Western | Tempranillo | Leather, tobacco, sun. Drink it out of a tin cup. |

## Behaviour

- A movie has **several** genres. Take the **first** TMDB genre so every phone
  shows the same pairing without extra state.
- Show the pairing on the winner reveal, under the ratings: `🍷 Pinot Noir —
  thin-skinned and emotionally complicated.`
- **Double features** (multiple movies watched in one night, which the group
  actually does) get a pairing per movie. If two movies share a pairing, say so
  and pour one bottle.
- No genre data → no wine line. Never invent a pairing for an unknown genre;
  silence is better than a wrong pour.

## Implementation

The mapping is static, so it ships as a plain object in the web app — no
migration, no table, nothing to sync. It becomes a shared module when the mobile
app needs it too.

Only if the group starts wanting to *edit* pairings from inside the app does this
earn a database table. Don't start there.

## Later

- Let people override the pairing for a specific movie ("we're having beer")
- A non-alcoholic column, so it's not a wine-only feature
- Snack pairing, which is the same shape of problem and probably more useful

Related: [[API Integrations]] · [[ROADMAP]]
