---
title: Obsidian Setup
type: process
tags: [movie-roulette, process, obsidian]
---

# Obsidian Setup

These notes live in the git repo and appear inside the existing **Vaultboy2**
vault. One copy, two ways in.

## How it's wired

```
/Users/xian/Projects/movie-roulette/docs/          ← the real files (git tracks these)
        ▲
        │ symlink
/Users/xian/Documents/Vaultboy2/Movie Night/Movie Roulette/
```

`Movie Night/Movie Roulette` is a symlink pointing at the repo's `docs/` folder.
Open Vaultboy2 as usual and the notes are there under **Movie Night → Movie
Roulette**, alongside the rest of your notes.

Editing a note in Obsidian writes straight into the repo — verified. So a note
tweaked on the couch is a normal `git commit` away from GitHub, with no copying
and no second version to reconcile.

`ROADMAP.md` sits at the repo root (where GitHub expects it) and is symlinked into
`docs/` too, so `[[ROADMAP]]` resolves from inside the vault.

## Recommended settings

- Settings → **Files & Links** → *New link format*: **Shortest path when possible**,
  so `[[Wine Pairing]]` works without the folder prefix.
- *(Optional)* The **Obsidian Git** plugin, pointed at `/Users/xian/Projects/movie-roulette`,
  will auto-commit note edits so they never sit uncommitted.

## Known limits of the symlink

- **Obsidian Sync and mobile:** symlinked folders generally don't sync to phones.
  If you want these notes on mobile, the alternatives are the Obsidian Git plugin
  on the device, or reading them on GitHub.
- If Obsidian ever stops indexing the folder after an update, the fallback is to
  open the repo as its own vault — the notes are plain markdown either way, so
  nothing is trapped.

## Division of labour

| Tool | Holds | Rule of thumb |
| --- | --- | --- |
| **GitHub Issues** | Work to be done, one item at a time | If someone could pick it up and finish it, it's an issue |
| **These notes** | Thinking, specs, decisions, dead ends | If it explains *why*, it's a note |
| **[[ROADMAP]]** | The shape of the next few months | Updated when a milestone opens or closes |

Don't duplicate issue lists into notes — link to them. Issues churn; notes should
stay readable a year later.

## Conventions

- Frontmatter on every note: `title`, `type`, `tags`.
- `type` is one of: `moc`, `spec`, `adr`, `process`, `reference`.
- Link generously. A link to a note that doesn't exist yet is a to-do, not a
  mistake.
- ADRs are **never edited after the fact** — supersede them with a new one so the
  reasoning trail survives.

Start at [[Movie Roulette Hub]].
