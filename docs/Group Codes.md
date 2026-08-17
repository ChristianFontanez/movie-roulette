---
title: Group Codes
type: spec
tags: [movie-roulette, mobile, later]
milestone: public-1.0
---

# Group Codes

Multiple friend groups, each with their own wheel. **Only needed for public
launch** — until then there is exactly one group and hardcoding that is correct.

## The problem it solves

Today "the group" is implicit: one passphrase, one set of players, one wheel. A
stranger who downloads a public app would land in your friend group and see your
movies. That's the blocker on M7, not a feature request.

## Design

- A **group** has a name, a short invite code (`MOVIE-4F2K`), and members
- Creating a group makes you its owner; sharing the code lets others join
- `movies`, `spins`, and `feature_requests` all gain a `group_id`
- The QR poster becomes per-group — the existing `qr.html` generator already does
  the hard part

## Migration

The existing friend group becomes group #1, and every existing row is stamped with
its id. One `update`, done once.

## Deliberately not doing

- Public/discoverable groups. This is for people who know each other.
- Multiple group membership at launch. One group per account is simpler and
  covers the real case; revisit if anyone actually asks.

Related: [[Auth and Accounts]] · [[ROADMAP]]
