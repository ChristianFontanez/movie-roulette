---
title: Feature Requests
type: spec
tags: [movie-roulette, feature, process]
milestone: web-1.1
---

# Feature Requests

The group has opinions. They should land somewhere better than a group chat that
scrolls away.

## The problem

None of your friends have GitHub accounts, and none of them are going to make
one. Any intake that starts with "open a pull request" collects nothing.

## The design

Two doors, one destination.

### Door 1 — in the app (for friends)

A **💡 Ideas** section in the ⚙️ menu:

- One text box, a name attached automatically, submit.
- Rows land in a Supabase `feature_requests` table: `id`, `body`, `player_id`,
  `created_at`, `status`, `votes`.
- Everyone sees the list and can **+1** an idea. Vote counts are the whole point —
  they turn "wouldn't it be cool if" into a priority order.
- Status shown as a plain word: `new`, `planned`, `building`, `shipped`,
  `not doing`. Set by you; visible to everyone so ideas don't vanish silently.

### Door 2 — GitHub Issues (for you)

The issue form at `.github/ISSUE_TEMPLATE/feature_request.yml` — structured
fields, auto-labelled, straight into the milestone view.

### Connecting them

Start manual: read the in-app list, promote the good ones to issues yourself, set
the status back to `planned`. It's a handful of ideas a week, not a support queue.

Automate only if that becomes tedious — a Supabase webhook → GitHub API call is
about 30 lines, and is its own issue on [[ROADMAP]] rather than part of this one.

## Why not just GitHub for everything

Because the requests would stop. Friction kills feature requests, and the ideas
worth building come from people mid-movie-night, not from people willing to fill
in a form. Meet them where they already are.

## Acceptance

- A friend can file an idea from their phone in under 15 seconds
- Everyone can see and upvote existing ideas
- Nothing is anonymous *(this is a friend group; attribution is half the fun)*
- Shipped ideas stay visible, marked shipped — credit where it's due

Related: [[ROADMAP]] · [[Data Model]]
