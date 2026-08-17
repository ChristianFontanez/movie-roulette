---
title: Movie Roulette Hub
type: moc
tags: [movie-roulette, hub]
---

# 🎬 Movie Roulette Hub

The map of content. Everything starts here.

## Plan

- [[ROADMAP]] — phases, milestones, what's next
- [[Release Process]] — how versions are cut and shipped
- [[Obsidian Setup]] — how this vault and GitHub stay in sync

## How it works today

- [[Architecture]] — the live web app, and how the mobile track stays isolated
- [[Data Model]] — tables, statuses, and what each column means

## Features

- [[Wine Pairing]] — pair a wine to the winning movie's genre
- [[Feature Requests]] — how friends' ideas get into the tracker
- [[API Integrations]] — what's wired up, what's possible, what isn't
- [[Auth and Accounts]] — real sign-in, and claiming existing history
- [[Push Notifications]] — the main reason to go native
- [[Group Codes]] — supporting more than one friend group

## Decisions

- [[ADR 0001 Mobile Stack]] — why Expo / React Native
- [[ADR 0002 Auth and RLS]] — why the current security model can't ship to stores
- [[ADR 0003 API Keys]] — why the movie API keys must move server-side

## Open threads

Things deliberately unresolved:

- Does the mobile app eventually replace the web app, or do both live on forever?
- Do we migrate the existing Supabase project, or start the mobile app on a
  fresh one and import? (See [[ADR 0002 Auth and RLS]].)
- Wine pairing: one wine per genre, or a short flight for a double feature?
