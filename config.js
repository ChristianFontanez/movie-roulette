// ============================================================
// Movie Roulette configuration.
//
// These values ship in the browser, so they are all "public" keys.
// The Supabase anon key is designed for this and is protected by the
// Row Level Security policies in schema.sql. The TMDB and OMDb keys
// are free; if either ever gets abused, just regenerate it and
// update this file.
// ============================================================
window.MOVIE_ROULETTE_CONFIG = {
  // Supabase → Project Settings → Data API / API Keys
  SUPABASE_URL: "https://oudndzmscdnjrmclslry.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_CWFWvimZ1ymrxhR29KtP_Q_IRIn6rQz",

  // themoviedb.org → Settings → API → "API Key (v3 auth)"
  // Powers movie search, posters, and release years.
  TMDB_API_KEY: "__TMDB_API_KEY__",

  // omdbapi.com/apikey.aspx → free key, arrives by email
  // Powers the IMDb rating and Rotten Tomatoes score.
  OMDB_API_KEY: "__OMDB_API_KEY__",
};
