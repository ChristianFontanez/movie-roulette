---
title: Release Process
type: process
tags: [movie-roulette, process]
---

# Release Process

## Web app

`git push` to `main` → CI runs → **deploy only happens if CI is green** → live in
a few minutes.

```
push ──▶ Static checks ──┐
                         ├──▶ Deploy to Pages ──▶ live
     ──▶ Boots in browser ┘        (main only)
```

- **Static checks** (~1s, no dependencies): JS parses, manifest is valid and
  installable, every file the page links and the service worker precaches
  exists, config has no placeholders and no secret key, docs wikilinks resolve.
- **Boots in a browser**: headless Chromium loads the app and asserts no uncaught
  exceptions, exactly one screen visible, not the config-error screen, and the
  wheel canvas actually painted.
- Run the fast half locally any time: `node scripts/checks.mjs`

Pages is configured as `build_type: workflow`, **not** the legacy publish-from-
branch mode — that's what makes the gate possible. The artifact is the repo
as-is, so no URLs changed, including the one on the printed QR poster.

Two things learned setting this up, worth not rediscovering:

- The smoke job runs inside `mcr.microsoft.com/playwright:<version>-noble`.
  Installing browsers on a bare runner (`--with-deps`) shells out to `apt-get`
  under sudo and hung for over ten minutes — useless as a deploy gate. The
  image tag and the `playwright@` version must match.
- Everyone's browser caches the service worker shell, so after a release the
  group needs to open the app **once while online** for it to pick up the new
  build.

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
