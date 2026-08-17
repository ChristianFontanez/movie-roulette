---
title: Push Notifications
type: spec
tags: [movie-roulette, mobile]
milestone: mobile-0.3
---

# Push Notifications

The clearest reason to be native rather than a PWA.

## Why this is the killer feature

Right now the group coordinates in a chat and the app is a thing you remember to
open. Reverse that and the app drives the ritual.

Web push can't do this reliably — iOS only delivers it to home-screen-installed
PWAs, which is precisely the audience that hasn't installed it.

## The notifications worth sending

| Trigger | Message | Why |
| --- | --- | --- |
| Movie night approaching | "Movie night in 2 hours — 3 movies on the wheel" | The nudge to add a pick before it's too late |
| Somebody spun | "Kia spun the wheel: **Mad Max: Fury Road** 🍷 Zinfandel" | Everyone finds out at once, even if they're not looking |
| Verdict needed | "Did you watch Mad Max? Tap to confirm" | Keeps the watched/skipped record honest |
| Nobody has added anything | "The wheel is empty and it's Thursday" | Prevents the dead week |

## Restraint

Four notification types is already near the limit for a movie app. One badly
timed push and people disable notifications forever — at which point the feature
is worse than not having built it.

- Per-type toggles in settings from day one
- Nothing between 11pm and 9am, ever
- "Somebody spun" goes to everyone **except** the person who spun

## Implementation

`expo-notifications` + a Supabase database webhook on insert into `spins`, calling
Expo's push API. Movie-night reminders need a scheduled function — a cron-triggered
Edge Function.

Requires a `push_tokens` table keyed to `auth.uid()`, so it depends on
[[Auth and Accounts]].

Related: [[ROADMAP]] · [[ADR 0001 Mobile Stack]]
