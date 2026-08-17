---
title: Obsidian Setup
type: process
tags: [movie-roulette, process, obsidian]
---

# Obsidian Setup

The repo **is** the vault. Notes live in `docs/`, code lives everywhere else, and
git carries both.

## One-time setup

1. Obsidian → **Open folder as vault** → `/Users/xian/Projects/movie-roulette`
2. Settings → **Files & Links** → set *New link format* to **Shortest path when
   possible** so `[[Wine Pairing]]` resolves without the `docs/` prefix.
3. *(Optional)* Install the **Obsidian Git** community plugin and point it at
   this repo. Auto-commit every 10 minutes means notes written on the couch are
   on GitHub by morning.

`.obsidian/` is gitignored — your workspace layout and plugin choices stay
personal, the notes are shared.

## Why the vault is inside the repo

Notes and the code they describe move together. A spec that lands in the same
commit as its feature never drifts, and `git log docs/` becomes the story of how
the product was reasoned about.

## Division of labour

| Tool | Holds | Rule of thumb |
| --- | --- | --- |
| **GitHub Issues** | Work to be done, one item at a time | If someone could pick it up and finish it, it's an issue |
| **This vault** | Thinking, specs, decisions, dead ends | If it explains *why*, it's a note |
| **[[ROADMAP]]** | The shape of the next few months | Updated when a milestone opens or closes |

Don't duplicate issue lists into notes — link to them. Issues churn; notes should
stay readable a year later.

## Conventions

- Every note gets frontmatter with `title`, `type`, and `tags`.
- `type` is one of: `moc`, `spec`, `adr`, `process`, `reference`.
- Link generously with `[[wikilinks]]`. A link to a note that doesn't exist yet is
  a to-do, not a mistake.
- Decisions go in an ADR and are **never edited after the fact** — supersede them
  with a new one instead, so the reasoning trail survives.
