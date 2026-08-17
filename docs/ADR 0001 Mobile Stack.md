---
title: ADR 0001 Mobile Stack
type: adr
status: accepted
date: 2026-08-17
tags: [movie-roulette, adr, mobile]
---

# ADR 0001 — Mobile stack

**Status:** accepted · **Date:** 2026-08-17

## Context

The group wants the roulette on their phones as a real app. The existing web app
is dependency-free HTML/CSS/JS on GitHub Pages with a canvas wheel — deliberately
simple, and working well.

Three routes were considered.

## Options

### Capacitor — wrap the existing web app

Ships to both stores in days and reuses every line of code.

Rejected as the primary route because App Store guideline **4.2 (minimum
functionality)** targets apps that are a website in a shell. This app *is*
currently a website in a shell, and it would be reviewed as one. Adding native
capability to pass review means writing native code anyway — at which point the
webview is a constraint rather than a shortcut.

### PWA only

Free, no review, installs from the QR code that already exists. But no store
presence, and iOS push notifications require the user to have installed the PWA
to their home screen — which is exactly the audience least likely to have done it.

Kept as a **fallback** and a cheap win on the web track, not as the answer.

### Expo / React Native — chosen

One JavaScript codebase, genuinely native shells, both stores.

- `@supabase/supabase-js` works as-is, so the data layer carries over conceptually
- Push notifications are a solved problem via `expo-notifications`
- EAS Build removes the need to babysit Xcode and Gradle
- OTA updates mean fixing a typo doesn't require a review cycle
- The canvas wheel becomes `@shopify/react-native-skia`, which is the part that
  needs real rewriting

## Decision

**Expo (React Native), in its own repository**, created at the start of M3.

The web app stays exactly where it is and keeps shipping features to the group.
The two share a roadmap, a Supabase-shaped mental model, and this vault — nothing
else. No shared build, no shared deploy, no chance of a mobile refactor taking
down Saturday.

## Consequences

- The wheel is a real rewrite. Budget for it; it's the app's signature.
- Two codebases means features can drift. The roadmap tracks each with
  `platform:web` / `platform:mobile` labels, and drift is accepted deliberately
  rather than fought.
- Requires an Apple Developer account ($99/yr) and Play Console ($25 once) before
  anything reaches a phone that isn't plugged into a laptop.
- If Expo turns out to be the wrong call, the fallback is Capacitor plus native
  push — the web app remains the working product throughout, so the downside is
  wasted effort, never a broken movie night.

Related: [[ADR 0002 Auth and RLS]] · [[Architecture]] · [[ROADMAP]]
