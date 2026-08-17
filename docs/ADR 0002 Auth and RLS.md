---
title: ADR 0002 Auth and RLS
type: adr
status: accepted
date: 2026-08-17
tags: [movie-roulette, adr, security]
---

# ADR 0002 — Auth and row level security

**Status:** accepted · **Date:** 2026-08-17

## Context

The web app's security model is a shared passphrase checked in the browser, over
a Supabase publishable key whose RLS policies grant the `anon` role
`for all … using (true) with check (true)` on every table.

Stated plainly: **the key ships to every visitor, and it can read, modify, and
delete every row in the database.** The passphrase is a UI gate, not a security
boundary — anyone who opens devtools can bypass it entirely.

For a private link shared with eight friends, that trade was deliberate and fine.
It stops being fine the moment the app is distributed through an app store,
because:

- Keys inside an app bundle are trivially extractable. This is not a
  vulnerability, it's how bundles work.
- The install base stops being people you know.
- One bored stranger can wipe several months of the group's movie history.

## Decision

The mobile app uses **Supabase Auth with per-user row level security from its
first commit.** Not retrofitted later.

- Sign-in: email magic link, plus Apple and Google sign-in (Apple sign-in is
  effectively required by App Store review once third-party sign-in exists).
- Every table gets policies scoped to `auth.uid()`. The `anon` role gets nothing.
- Group membership becomes explicit: a `group_members` table decides who can see
  which week's movies, rather than "everyone with the key sees everything".

## The migration problem

The group has real history — players, movies, and spins going back to July 2026 —
and none of it is attached to an account.

**Decision: the mobile app starts on a fresh Supabase project**, and history is
imported once, rather than mutating the database the live web app depends on.
This keeps the tracks isolated as required by [[Architecture]]: no mobile work
can break Saturday's movie night.

The import needs a **"claim your player"** flow — sign in, pick which existing
name is you, and your history follows. It's one screen, shown once, and it is
the difference between a new app and the group's app.

## Consequences

- The web app keeps its current model and stays on its current project. It is
  explicitly a private-link app, and that's now a documented choice rather than
  an oversight.
- Two Supabase projects for a while. Acceptable: the free tier allows it, and the
  isolation is the point.
- Whether the web app eventually moves onto the authenticated database is left
  open until the mobile app is real. Deciding now would be guessing.
- Until public launch (M7), the beta stays on TestFlight and Play internal
  testing, where the audience is still people you know.

## Also, unrelated to auth but overdue

The Supabase **secret** key was pasted into a chat log on 2026-07-21. It grants
full admin access and bypasses RLS entirely. It should be rotated regardless of
anything above: **Project Settings → API Keys → Secret keys → roll**.

Related: [[ADR 0003 API Keys]] · [[Auth and Accounts]] · [[Architecture]]
