---
title: Release Process
type: process
tags: [movie-roulette, process]
---

# Release Process

## Web app

Continuous. `git push` to `main` → GitHub Pages rebuilds in ~1 minute → everyone
hard-refreshes.

- **Versioning:** tag `web-v1.1`, `web-v1.2` at each milestone close. Tags, not
  branches — there's one live version and no need to support old ones.
- **Migrations:** a numbered `schema-update-N.sql`, run by hand in the Supabase SQL
  editor. Every one must be safe to re-run (`if not exists`, idempotent updates).
- **The rule that matters:** code that needs a migration must degrade gracefully
  until it runs. The spin insert falling back when attribution columns are missing
  is the pattern — nobody's Saturday breaks because a migration is pending.

## Mobile app

Not continuous. Store review and testers make this deliberate.

- **Versioning:** `mobile-v0.1` … `mobile-v1.0`, matching [[ROADMAP]] milestones.
- **Channels:** Expo EAS → TestFlight (iOS) + Play internal testing (Android).
- **OTA updates** for JS-only fixes; a real build only when native code changes.
- **Release notes** in every build. The group *is* the QA team, so tell them what
  to poke at.

## Definition of done

An item is done when:

1. It works on a real phone, not just a desktop browser
2. Any migration has been applied and verified against the live database
3. The relevant note in `docs/` reflects what was actually built
4. The issue is closed with a line on what shipped

## Cadence

No sprints, no dates. It's a hobby project for a friend group; deadlines would
just be lies. Milestones close when their issues close.

The one soft commitment: **the web app stays working every Saturday.** That
outranks every roadmap item.

Related: [[ROADMAP]] · [[Obsidian Setup]]
