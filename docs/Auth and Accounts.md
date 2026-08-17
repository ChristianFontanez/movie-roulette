---
title: Auth and Accounts
type: spec
tags: [movie-roulette, mobile, security]
milestone: mobile-0.1
---

# Auth and Accounts

The mobile app's foundation. See [[ADR 0002 Auth and RLS]] for why this can't be
bolted on later.

## Sign-in

- **Email magic link** — no passwords to manage or leak
- **Apple sign-in** — effectively mandatory for App Store review once any
  third-party sign-in exists
- **Google sign-in** — most of the group is on Android

## Claim your player

The group has history from July 2026 onward under names like Christian, Kia, and
Ted Cruz is the Zodiac K. None of it is attached to an account.

Shown once, after first sign-in:

> **Which one is you?**
> [ Christian ] [ Kia ] [ Smavery ] [ Melissa ] … [ I'm new ]

Picking a name links `auth.uid()` to that existing player row, and every movie
they added and every spin they won comes with them. Getting this right is the
difference between "a new app" and "our app, on my phone".

Guard rails:

- A player can only be claimed once; taken names show who holds them
- "I'm new" creates a fresh player
- Mis-claims are fixable by you, not self-service — it's a friend group, not a
  helpdesk

## RLS shape

Every policy keys off `auth.uid()`. The `anon` role gets nothing.

- A movie is editable by its owner; deletable by its owner **or** anyone in the
  group (the current app lets anyone tidy up, and that has worked fine)
- Spins are insertable by any group member
- Outcomes (`watched` / `skipped`) are settable by any group member — deciding is
  a group act, not the spinner's privilege

## Deliberately deferred

Account deletion is an **M7** gate, not an M3 one. Apple requires it for public
release; TestFlight users are people you can text.

Related: [[Group Codes]] · [[Data Model]]
