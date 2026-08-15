# 🎬 Movie Roulette

A tiny mobile-first web app for a group of friends to pick each week's movie by
spinning a roulette wheel. Everyone uses their own phone; the wheel, movie lists,
and results sync live for everyone.

**How it works**
- Everyone picks/creates their name (saved on their device).
- Each week, people add movies (tagged with who added them).
- Search pulls posters and release years from TMDB, plus the IMDb rating and
  Rotten Tomatoes score from OMDb.
- Anyone can spin the wheel — it lands on one of *this week's* movies, live on
  every phone at once. The winner is only revealed once the wheel stops.
- Every movie is always eligible; there are no sit-out restrictions.

Access is gated by a shared group **passphrase** (the first person to open the
app sets it).

## Stack
- Static HTML/CSS/JS (no build step) → **GitHub Pages**
- **Supabase** (Postgres + Realtime) for shared state

## Setup (one time)

### 1. Create a Supabase project
1. Go to <https://supabase.com>, sign in, **New project** (free tier is fine).
2. Once it's ready, open **SQL Editor → New query**, paste the contents of
   [`schema.sql`](schema.sql), and click **Run**.
3. Open **Project Settings → API** and copy:
   - **Project URL**
   - **anon / public** API key

### 2. Configure the app
Put those two values in [`config.js`](config.js):
```js
window.MOVIE_ROULETTE_CONFIG = {
  SUPABASE_URL: "https://YOURPROJECT.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGci...",
};
```

### 2b. Movie search keys (optional but recommended)
Without these the app still works — you just type titles by hand, with no
posters or ratings.

- **TMDB** (search, posters, years): sign up at
  <https://www.themoviedb.org/signup>, then **Settings → API** and copy the
  **API Key (v3 auth)**.
- **OMDb** (IMDb rating + Rotten Tomatoes score): request a free key at
  <https://www.omdbapi.com/apikey.aspx> — it arrives by email, 1,000
  lookups/day.

Add both to `config.js` as `TMDB_API_KEY` and `OMDB_API_KEY`, and run
[`schema-update.sql`](schema-update.sql) in the Supabase SQL Editor to add the
poster/rating columns.

### 3. Deploy
It's already on GitHub Pages. Any push to `main` updates the live site.

## Notes
- The anon key is meant to be public; Row Level Security in `schema.sql` scopes it
  to just this app's tables. The passphrase is a soft gate for a private friend
  group — good enough to keep out strangers who stumble on the link.
- "Week" runs Monday→Sunday in each visitor's local time.
