# 🎬 Movie Roulette — Roadmap

Two tracks, one plan. They share a roadmap and this issue tracker, but **not a
codebase**.

| Track | What it is | Where it lives | Status |
| --- | --- | --- | --- |
| **Web** | The app the group uses every week | this repo → [live site](https://christianfontanez.github.io/movie-roulette/) | 🟢 Live, stays stable |
| **Mobile** | Native iOS + Android app | `movie-roulette-mobile` (created at the start of M3) | ⚪️ Not started |

The web app is **not** being replaced. It keeps getting features for the group
while the mobile app is built alongside it. Nothing in the mobile track is
allowed to destabilise the web track — see [[Architecture]] for how they stay
isolated.

---

## Milestones

| # | Milestone | Track | Goal |
| --- | --- | --- | --- |
| M1 | **web-1.1 — Feature Requests** | Web | Let friends file ideas from their phones |
| M2 | **web-1.2 — Depth & Polish** | Web | Richer movie data, group stats |
| M3 | **mobile-0.1 — Skeleton** | Mobile | Expo app runs, real accounts work |
| M4 | **mobile-0.2 — Parity** | Mobile | Everything the web app does |
| M5 | **mobile-0.3 — Native wins** | Mobile | Push notifications, offline, share sheet |
| M6 | **mobile-1.0 — Private beta** | Mobile | On the group's phones via TestFlight + Play internal testing |
| M7 | **public-1.0 — Store launch** | Both | Anyone can download it *(deliberately last)* |

---

## M1 · web-1.1 — Feature Requests

- **Feature requests** — friends can file ideas from inside the app, without a
  GitHub account. See [[Feature Requests]].
- **Rotate the exposed Supabase secret key** — overdue housekeeping.

## Parked · Wine pairing

Not on a milestone, and deliberately so. The pairings are **owned by the group's
wine person** — the wine for each genre and the line that goes with it are his to
write, not an engineering decision.

The code side is a short job whenever his list lands: TMDB already returns genres
for free, and [[Wine Pairing]] holds the empty 19-genre worksheet plus the
integration notes. No placeholder pairings in the meantime.

## M2 · web-1.2 — Depth & Polish

- Trailer button on the winner (TMDB returns YouTube keys — verified)
- "Where to watch" deep link (TMDB provides a JustWatch-backed link)
- Cast, content rating, and genre chips on each movie
- Group stats: most-watched genre, who picks the most winners, longest streak
- Data hygiene: dedupe near-identical titles, fix the movies still missing metadata

## M3 · mobile-0.1 — Skeleton

The first mobile work. **Blocked on nothing, but do [[Auth and Accounts]] first
— it is the foundation everything else sits on.**

- New repo + Expo project, CI that builds both platforms
- **Supabase Auth with per-user row level security** — see [[ADR 0002 Auth and RLS]]
- **Move the TMDB/OMDb keys server-side** — keys in an app bundle are
  extractable, see [[ADR 0003 API Keys]]
- "Claim your player" flow: sign in, then attach yourself to your existing
  history (Christian, Kia, …) so nothing is lost

## M4 · mobile-0.2 — Parity

- The wheel, in `react-native-skia`
- Add / search / delete movies, notes, watched & set-aside tracking
- Live sync via Supabase realtime
- Past picks history

## M5 · mobile-0.3 — Native wins

Things the web app fundamentally cannot do well:

- **Push notifications** — "movie night in 2 hours", "the wheel has been spun"
- Offline read of this week's list
- Share sheet: post the winner to the group chat
- Home-screen widget showing this week's pick *(stretch)*

## M6 · mobile-1.0 — Private beta

- TestFlight (iOS) + Play internal testing — up to 100 testers, no public review
- Apple Developer account ($99/yr) and Play Console ($25 one-time) required
- App icon, splash, onboarding
- Crash reporting

## M7 · public-1.0 — Store launch

Intentionally last. Everything here is a gate, not a feature:

- Privacy policy and in-app account deletion (Apple requires both)
- Store listings, screenshots, review notes
- Multi-group support so strangers aren't dropped into your friend group —
  see [[Group Codes]]
- Rate limiting and abuse review on every table

---

## How this is tracked

- **GitHub is the source of truth.** Every roadmap item above is an issue,
  labelled by track (`platform:web`, `platform:mobile`) and grouped into the
  milestones above. The board shows what's in flight.
- **Obsidian is for thinking.** The `docs/` folder is a vault — specs, decisions,
  and notes with wikilinks. See [[Obsidian Setup]].
- **Releases are tagged** in git and written up in [[Release Process]].

Start at the [[Movie Roulette Hub]].
