import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ------------------------------------------------------------------
// Config / boot
// ------------------------------------------------------------------
const CFG = window.MOVIE_ROULETTE_CONFIG || {};
const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove("hidden");
const hide = (id) => $(id).classList.add("hidden");
const only = (id) => {
  ["gate", "whoami", "app", "boot-error"].forEach((s) =>
    $(s).classList.toggle("hidden", s !== id)
  );
};

if (
  !CFG.SUPABASE_URL ||
  !CFG.SUPABASE_ANON_KEY ||
  CFG.SUPABASE_URL.includes("__SUPABASE_URL__")
) {
  $("boot-error-msg").textContent =
    "Supabase isn't configured yet. Add your project URL and anon key to config.js.";
  only("boot-error");
  throw new Error("Missing Supabase config");
}

const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
const TWO_PI = Math.PI * 2;
const LS_UNLOCK = "mr_unlocked";
const LS_PLAYER = "mr_player";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mondayOf(date) {
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (x.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  x.setDate(x.getDate() - dow);
  return x;
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function prettyWeek(monday) {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  const opt = { month: "short", day: "numeric" };
  return `Week of ${monday.toLocaleDateString(undefined, opt)} – ${end.toLocaleDateString(
    undefined,
    opt
  )}`;
}

const nowMonday = mondayOf(new Date());
const CUR_WEEK = ymd(nowMonday);

// ------------------------------------------------------------------
// Movie lookup: TMDB for search/posters, OMDb for IMDb + RT scores.
// Both are optional — without keys the app still takes typed titles.
// ------------------------------------------------------------------
const TMDB_KEY = usableKey(CFG.TMDB_API_KEY);
const OMDB_KEY = usableKey(CFG.OMDB_API_KEY);
const TMDB_IMG = "https://image.tmdb.org/t/p/w185";
const PROVIDER_REGION = "US"; // change if your group streams elsewhere

function usableKey(k) {
  return k && !k.includes("__") ? k : null;
}

async function searchMovies(query, signal) {
  if (!TMDB_KEY) return [];
  const url =
    `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(TMDB_KEY)}` +
    `&include_adult=false&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const json = await res.json();
  return (json.results || []).slice(0, 6).map((r) => ({
    tmdb_id: r.id,
    title: r.title,
    year: r.release_date ? r.release_date.slice(0, 4) : null,
    poster_url: r.poster_path ? TMDB_IMG + r.poster_path : null,
  }));
}

// TMDB only matches title prefixes, so a near-miss finds nothing. OMDb
// indexes differently and often catches what TMDB misses.
async function searchOMDbTitles(query, signal) {
  if (!OMDB_KEY) return [];
  const url =
    `https://www.omdbapi.com/?apikey=${encodeURIComponent(OMDB_KEY)}` +
    `&type=movie&s=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = await res.json();
  if (!json || json.Response === "False") return [];
  return (json.Search || []).slice(0, 6).map((r) => ({
    imdb_id: r.imdbID,
    title: r.Title,
    year: r.Year ? String(r.Year).slice(0, 4) : null,
    poster_url: r.Poster && r.Poster !== "N/A" ? r.Poster : null,
  }));
}

const omdbUrl = (params) =>
  `https://www.omdbapi.com/?apikey=${encodeURIComponent(OMDB_KEY)}&${params}`;

// Pull the ratings (and poster/year, when we don't already have them) for a
// pick. Ratings are a nice-to-have: any failure just leaves them blank.
async function fetchDetails(pick) {
  const out = { imdb_id: pick.imdb_id || null, imdb_rating: null, rt_score: null };

  // A TMDB pick doesn't carry an IMDb id, so translate it first.
  if (!out.imdb_id && pick.tmdb_id && TMDB_KEY) {
    try {
      const r = await fetch(
        `https://api.themoviedb.org/3/movie/${pick.tmdb_id}/external_ids?api_key=${encodeURIComponent(TMDB_KEY)}`
      );
      if (r.ok) out.imdb_id = (await r.json()).imdb_id || null;
    } catch (_) {}
  }
  if (!OMDB_KEY) return out;

  // By id when we have one, otherwise by title — which is how a hand-typed
  // entry still picks up a poster and ratings.
  const query = out.imdb_id
    ? `i=${encodeURIComponent(out.imdb_id)}`
    : `t=${encodeURIComponent(pick.title)}`;
  try {
    const r = await fetch(omdbUrl(query));
    if (!r.ok) return out;
    const j = await r.json();
    if (!j || j.Response === "False") return out;
    if (j.imdbRating && j.imdbRating !== "N/A") out.imdb_rating = j.imdbRating;
    const rt = (j.Ratings || []).find((x) => x.Source === "Rotten Tomatoes");
    if (rt && rt.Value) out.rt_score = rt.Value;
    if (!out.imdb_id && j.imdbID) out.imdb_id = j.imdbID;
    if (j.Runtime && j.Runtime !== "N/A") out.runtime = j.Runtime;
    // Fill artwork/year only if the pick arrived without them.
    if (!pick.poster_url && j.Poster && j.Poster !== "N/A") out.poster_url = j.Poster;
    if (!pick.year && j.Year) out.year = String(j.Year).slice(0, 4);
  } catch (_) {}

  const providers = await fetchProviders(pick.tmdb_id, out.imdb_id);
  if (providers) out.providers = providers;
  return out;
}

// Where you can stream it right now (subscription services only, US).
async function fetchProviders(tmdbId, imdbId) {
  if (!TMDB_KEY) return null;
  const key = encodeURIComponent(TMDB_KEY);
  let id = tmdbId;
  // An OMDb pick has no TMDB id, so look it up by its IMDb id.
  if (!id && imdbId) {
    try {
      const r = await fetch(
        `https://api.themoviedb.org/3/find/${imdbId}?api_key=${key}&external_source=imdb_id`
      );
      if (r.ok) {
        const j = await r.json();
        id = (j.movie_results && j.movie_results[0] || {}).id || null;
      }
    } catch (_) {}
  }
  if (!id) return null;
  try {
    const r = await fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${key}`);
    if (!r.ok) return null;
    const j = await r.json();
    const flat = ((j.results || {})[PROVIDER_REGION] || {}).flatrate || [];
    if (!flat.length) return null;
    // Trim the noisy "… Amazon Channel" style duplicates.
    const names = [...new Set(flat.map((p) => p.provider_name.replace(/ (Amazon Channel|Apple TV Channel)$/, "")))];
    return names.slice(0, 3).join(", ");
  } catch (_) {
    return null;
  }
}

// Deterministic pleasant colors so the wheel looks the same for everyone
const COLORS = [
  "#ff4d6d", "#7c5cff", "#3ddc97", "#ffd76b", "#4dc9ff",
  "#ff8f4d", "#c264ff", "#54e0c7", "#ff6fb5", "#8fd94d",
];
const colorFor = (i) => COLORS[i % COLORS.length];

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
let me = null; // { id, name }
let players = [];
let movies = []; // this week's movies
let weekSpins = []; // every spin this week, oldest first
let openSpin = null; // the latest spin still awaiting a watched/skipped call
let rotation = 0; // current wheel rotation (radians)
let animating = false;
let lastAnimatedSpinId = null;
// A spin already on the books when we open the app is shown at rest; only a
// spin that lands while we're watching gets the suspense animation.
let seenFirstRender = false;

// ------------------------------------------------------------------
// Passphrase gate
// ------------------------------------------------------------------
// A failed read and "no passphrase set yet" are very different things: the
// first must never be mistaken for the second, or a flaky connection would
// invite someone to set a new group passphrase over the real one.
async function getStoredHash() {
  const { data, error } = await sb
    .from("app_config")
    .select("value")
    .eq("key", "passphrase_hash")
    .maybeSingle();
  if (error) return { ok: false, value: null, error };
  return { ok: true, value: data ? data.value : null };
}

async function initGate() {
  const gateSub = $("gate-sub");
  const err = $("gate-error");
  err.classList.add("hidden");

  const res = await getStoredHash();
  if (!res.ok) {
    // Couldn't reach the database — offer a retry, never the setup screen.
    gateSub.textContent = "Can't reach the movie list right now.";
    $("gate-input").classList.add("hidden");
    const btn = $("gate-form").querySelector("button");
    btn.textContent = "Try again";
    only("gate");
    showErr(err, "Check your connection and try again.");
    $("gate-form").onsubmit = (e) => {
      e.preventDefault();
      $("gate-input").classList.remove("hidden");
      initGate();
    };
    return;
  }
  $("gate-input").classList.remove("hidden");
  const stored = res.value;

  // Already unlocked on this device and passphrase unchanged?
  if (stored && localStorage.getItem(LS_UNLOCK) === stored) {
    return afterUnlock();
  }

  const firstTime = !stored;
  gateSub.textContent = firstTime
    ? "Set a group passphrase for your friends"
    : "Enter the group passphrase";
  $("gate-input").placeholder = firstTime ? "Create a passphrase" : "Passphrase";
  $("gate-form").querySelector("button").textContent = firstTime ? "Create" : "Enter";
  only("gate");

  $("gate-form").onsubmit = async (e) => {
    e.preventDefault();
    err.classList.add("hidden");
    const val = $("gate-input").value.trim();
    if (!val) return;
    const hash = await sha256(val);

    if (firstTime) {
      // insert, not upsert: if someone set a passphrase in the meantime this
      // fails on the primary key instead of quietly replacing theirs.
      const { error } = await sb
        .from("app_config")
        .insert({ key: "passphrase_hash", value: hash });
      if (error) {
        showErr(err, "Someone just set a passphrase — ask them for it.");
        $("gate-input").value = "";
        return initGate();
      }
      localStorage.setItem(LS_UNLOCK, hash);
      return afterUnlock();
    }
    if (hash === stored) {
      localStorage.setItem(LS_UNLOCK, hash);
      return afterUnlock();
    }
    showErr(err, "That passphrase doesn't match. Try again.");
    $("gate-input").value = "";
  };
}

function showErr(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}

// ------------------------------------------------------------------
// Who am I
// ------------------------------------------------------------------
async function afterUnlock() {
  const saved = localStorage.getItem(LS_PLAYER);
  if (saved) {
    try {
      const p = JSON.parse(saved);
      // confirm the player still exists
      const { data } = await sb.from("players").select("id,name").eq("id", p.id).maybeSingle();
      if (data) {
        me = data;
        return startApp();
      }
    } catch (_) {}
    localStorage.removeItem(LS_PLAYER);
  }
  return initWhoami();
}

async function loadPlayers() {
  const { data } = await sb.from("players").select("id,name").order("name");
  players = data || [];
}

async function initWhoami() {
  await loadPlayers();
  const list = $("player-list");
  list.innerHTML = "";
  players.forEach((p) => {
    const b = document.createElement("button");
    b.className = "player-pick";
    b.textContent = p.name;
    b.onclick = () => pickPlayer(p);
    list.appendChild(b);
  });
  const err = $("whoami-error");
  $("add-player-form").onsubmit = async (e) => {
    e.preventDefault();
    err.classList.add("hidden");
    const name = $("new-player-name").value.trim();
    if (!name) return;
    // reuse existing name if it already exists (case-insensitive)
    const existing = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return pickPlayer(existing);
    const { data, error } = await sb
      .from("players")
      .insert({ name })
      .select("id,name")
      .single();
    if (error) return showErr(err, error.message);
    pickPlayer(data);
  };
  only("whoami");
}

function pickPlayer(p) {
  me = p;
  localStorage.setItem(LS_PLAYER, JSON.stringify(p));
  startApp();
}

// ------------------------------------------------------------------
// Main app
// ------------------------------------------------------------------
let realtimeChannel = null;

async function startApp() {
  only("app");
  $("who-chip").textContent = `👤 ${me.name}`;
  $("who-chip").onclick = () => initWhoami();
  $("week-label").textContent = prettyWeek(nowMonday);

  $("add-movie-form").onsubmit = onAddMovie;
  $("spin-btn").onclick = onSpin;
  setupMenu();
  setupSearch();

  await reload();
  if (await maybeCarryOver()) await reload();
  await loadWatched();
  render();
  subscribeRealtime();
}

// --- previously watched -------------------------------------------
// Everything the wheel has ever landed on, so we can warn about repeats.
let watched = [];

// Movies actually watched in earlier weeks — the basis for repeat warnings.
// Matching on imdb_id as well as title means a re-add still catches when the
// spelling differs ("Kung fu hustle" vs "Kungfu Hustle").
async function loadWatched() {
  const { data } = await sb
    .from("movies")
    .select("title,imdb_id,week_start")
    .eq("status", "watched")
    .lt("week_start", CUR_WEEK)
    .order("week_start", { ascending: false });
  if (!data) return;
  watched = data.map((m) => ({
    title: m.title,
    key: normTitle(m.title),
    imdb_id: m.imdb_id || null,
    week: m.week_start,
  }));
}

const normTitle = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function findWatched(pick) {
  const key = normTitle(pick.title);
  return (
    watched.find((w) => pick.imdb_id && w.imdb_id && w.imdb_id === pick.imdb_id) ||
    watched.find((w) => w.key === key) ||
    null
  );
}

// ------------------------------------------------------------------
// Menu / reset
// ------------------------------------------------------------------
function openMenu() {
  $("reset-pass").value = "";
  $("reset-msg").className = "small hidden";
  $("menu").classList.remove("hidden");
  renderPlayerAdmin();
  loadHistory();
}
function closeMenu() {
  $("menu").classList.add("hidden");
}
// --- people -------------------------------------------------------
function renderPlayerAdmin() {
  const box = $("player-admin");
  box.innerHTML = "";
  if (!players.length) return box.appendChild(noteEl("No one yet."));
  players.forEach((p) => {
    const row = document.createElement("div");
    row.className = "padmin-row";
    const name = document.createElement("div");
    name.className = "padmin-name";
    name.textContent = p.name + (p.id === me.id ? " (you)" : "");
    const rename = document.createElement("button");
    rename.className = "padmin-btn";
    rename.type = "button";
    rename.textContent = "Rename";
    rename.onclick = () => renamePlayer(p);
    const del = document.createElement("button");
    del.className = "padmin-btn danger";
    del.type = "button";
    del.textContent = "Remove";
    del.onclick = () => removePlayer(p);
    row.append(name, rename, del);
    box.appendChild(row);
  });
}

async function renamePlayer(p) {
  const next = prompt(`Rename "${p.name}" to:`, p.name);
  if (next === null) return;
  const name = next.trim().slice(0, 24);
  if (!name || name === p.name) return;
  const { error } = await sb.from("players").update({ name }).eq("id", p.id);
  if (error) return alert(error.message);
  if (p.id === me.id) {
    me = { ...me, name };
    localStorage.setItem(LS_PLAYER, JSON.stringify(me));
    $("who-chip").textContent = `👤 ${me.name}`;
  }
  await reload();
  renderPlayerAdmin();
}

async function removePlayer(p) {
  // Movies are tied to their owner with ON DELETE CASCADE, so spell out
  // exactly what's about to disappear before doing it.
  const { count } = await sb
    .from("movies")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", p.id);
  const n = count || 0;
  const warning =
    `Remove "${p.name}"?\n\n` +
    (n
      ? `This also deletes ${n} movie${n > 1 ? "s" : ""} they added, including any on this week's wheel.`
      : `They haven't added any movies.`) +
    `\n\nPast spin results are kept.`;
  if (!confirm(warning)) return;

  const { error } = await sb.from("players").delete().eq("id", p.id);
  if (error) return alert(error.message);
  if (p.id === me.id) {
    localStorage.removeItem(LS_PLAYER);
    closeMenu();
    return initWhoami();
  }
  await reload();
  renderPlayerAdmin();
  loadHistory();
}

// --- past picks ---------------------------------------------------
function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d); // local time, not UTC
}

async function loadHistory() {
  const box = $("history");
  box.innerHTML = `<div class="sr-note">Loading…</div>`;

  const [{ data: past, error }, { data: spins }] = await Promise.all([
    sb.from("movies").select("*").lt("week_start", CUR_WEEK).order("created_at"),
    sb.from("spins").select("*").lt("week_start", CUR_WEEK).order("created_at"),
  ]);
  if (error) {
    box.innerHTML = "";
    box.appendChild(noteEl(error.message));
    return;
  }
  if (!past || !past.length) {
    box.innerHTML = "";
    box.appendChild(noteEl("No past movie nights yet — this is your first week!"));
    return;
  }

  // Who spun each movie, so the history can still say "spun by …".
  const spunBy = {};
  (spins || []).forEach((s) => {
    if (s.winning_movie_id && s.spun_by_name) spunBy[s.winning_movie_id] = s.spun_by_name;
  });

  const byWeek = {};
  past.forEach((m) => (byWeek[m.week_start] = byWeek[m.week_start] || []).push(m));

  box.innerHTML = "";
  Object.keys(byWeek)
    .sort()
    .reverse()
    .forEach((week) => box.appendChild(historyWeek(week, byWeek[week], spunBy)));
}

function noteEl(text) {
  const d = document.createElement("div");
  d.className = "sr-note";
  d.textContent = text;
  return d;
}

// One block per week: everything watched (there may be several), then the
// movies that were passed over or never came up.
function historyWeek(week, weekMovies, spunBy) {
  const watchedList = weekMovies.filter((m) => statusOf(m) === "watched");
  const rest = weekMovies.filter((m) => statusOf(m) !== "watched");

  const wrap = document.createElement("div");
  wrap.className = "hist-week-block";

  const head = document.createElement("div");
  head.className = "hist-week";
  head.textContent =
    prettyWeek(parseYmd(week)) +
    (watchedList.length > 1 ? ` · ${watchedList.length} movies` : "");
  wrap.appendChild(head);

  if (!watchedList.length) {
    const none = document.createElement("div");
    none.className = "hist-none";
    none.textContent = "nothing watched this week";
    wrap.appendChild(none);
  }

  watchedList.forEach((m) => {
    const row = document.createElement("div");
    row.className = "hist-item";
    row.appendChild(posterEl(m.poster_url, "hist-poster"));
    const main = document.createElement("div");
    main.className = "hist-main";
    main.innerHTML = `<div class="hist-title"></div><div class="hist-who"></div>`;
    main.querySelector(".hist-title").textContent = m.title;
    main.querySelector(".hist-who").textContent = [
      m.year,
      m.runtime,
      `${playerName(m.owner_id)}'s pick`,
      spunBy[m.id] ? `spun by ${spunBy[m.id]}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const badges = ratingsEl(m);
    if (badges) main.appendChild(badges);
    row.appendChild(main);
    wrap.appendChild(row);
  });

  if (rest.length) {
    const also = document.createElement("div");
    also.className = "hist-also";
    also.textContent = `not watched: ${rest.map((m) => m.title).join(", ")}`;
    wrap.appendChild(also);
  }
  return wrap;
}

function setupMenu() {
  $("menu-btn").onclick = openMenu;
  $("menu-close").onclick = closeMenu;
  $("menu-backdrop").onclick = closeMenu;
  $("reset-form").onsubmit = onReset;
  $("backfill-btn").onclick = onBackfill;
}

// Fill in posters/ratings for movies that were typed rather than picked
// from search. Looked up by title, so obscure spellings may not resolve.
async function onBackfill() {
  const btn = $("backfill-btn");
  const msg = $("backfill-msg");
  btn.disabled = true;
  msg.className = "small muted";
  msg.textContent = "Looking things up…";

  const { data: rows, error } = await sb
    .from("movies")
    .select("*")
    .is("poster_url", null)
    .limit(25);
  if (error) {
    msg.className = "small bad";
    msg.textContent = error.message;
    btn.disabled = false;
    return;
  }
  if (!rows || !rows.length) {
    msg.className = "small ok";
    msg.textContent = "Everything already has artwork. 🎉";
    btn.disabled = false;
    return;
  }

  let filled = 0;
  for (const m of rows) {
    const details = await fetchDetails(m);
    const patch = Object.fromEntries(Object.entries(details).filter(([, v]) => v));
    if (!Object.keys(patch).length) continue;
    const { error: upErr } = await sb.from("movies").update(patch).eq("id", m.id);
    if (!upErr) filled++;
  }

  msg.className = filled ? "small ok" : "small muted";
  msg.textContent = filled
    ? `Updated ${filled} of ${rows.length} movie${rows.length > 1 ? "s" : ""}.`
    : `Couldn't find details for ${rows.length === 1 ? "that movie" : "those movies"}.`;
  btn.disabled = false;
  await reload();
  loadHistory();
}

async function onReset(e) {
  e.preventDefault();
  const msg = $("reset-msg");
  msg.className = "small hidden";
  const val = $("reset-pass").value.trim();
  if (!val) return;

  const hash = await sha256(val);
  const stored = await getStoredHash();
  if (!stored.ok) {
    msg.textContent = "Couldn't reach the database — try again.";
    msg.className = "small bad";
    return;
  }
  if (!stored.value || hash !== stored.value) {
    msg.textContent = "That passphrase doesn't match.";
    msg.className = "small bad";
    return;
  }

  // Clear the week's spins and put every movie back on the wheel.
  const { error } = await sb.from("spins").delete().eq("week_start", CUR_WEEK);
  if (error) {
    msg.textContent = error.message;
    msg.className = "small bad";
    return;
  }
  await sb
    .from("movies")
    .update({ status: "pending", watched_at: null })
    .eq("week_start", CUR_WEEK);

  lastAnimatedSpinId = null;
  $("reset-pass").value = "";
  await reload();
  msg.textContent = "Done — every movie is back on the wheel!";
  msg.className = "small ok";
  setTimeout(closeMenu, 1400);
}

// Movies that didn't get picked last week roll into this week, so nobody
// has to retype them. Several phones can open at once, so the work is
// claimed with an insert into app_config: its primary key means exactly
// one client wins the race and the rest bail out.
async function maybeCarryOver() {
  if (movies.length) return false; // this week already has picks

  const claimKey = `carried_${CUR_WEEK}`;
  const { error: claimErr } = await sb
    .from("app_config")
    .insert({ key: claimKey, value: new Date().toISOString() });
  if (claimErr) return false; // another device already handled it

  // From here on the claim is held, so every exit has to either finish the
  // copy or hand the claim back. Dropping it on the floor would skip this
  // week's carry-over permanently, with nothing on screen to explain why.
  const release = async () => {
    await sb.from("app_config").delete().eq("key", claimKey);
    return false;
  };

  const { data: prevMovies, error: prevErr } = await sb
    .from("movies")
    .select("*")
    .eq("week_start", PREV_WEEK)
    .order("created_at");
  if (prevErr) return release(); // couldn't read last week — try again later
  if (!prevMovies || !prevMovies.length) return false; // genuinely nothing to carry

  // Anything you didn't actually watch gets another shot — including the
  // ones the wheel picked but the group passed on.
  const rollovers = prevMovies
    .filter((m) => statusOf(m) !== "watched")
    .map((m) => ({
      title: m.title,
      owner_id: m.owner_id,
      week_start: CUR_WEEK,
      year: m.year,
      poster_url: m.poster_url,
      tmdb_id: m.tmdb_id,
      imdb_id: m.imdb_id,
      imdb_rating: m.imdb_rating,
      rt_score: m.rt_score,
      runtime: m.runtime,
      providers: m.providers,
      note: m.note,
      carried_over: true,
      status: "pending",
    }));
  if (!rollovers.length) return false; // everything last week was watched

  const { error } = await sb.from("movies").insert(rollovers);
  if (error) return release(); // copy failed — let the next open retry
  return true;
}

async function reload() {
  await reloadDataOnly();
  render();
}

function playerName(id) {
  const p = players.find((x) => x.id === id);
  return p ? p.name : "Someone";
}

const statusOf = (m) => m.status || "pending";

// Movies still up for grabs — these are the wheel segments.
// Stable order so every phone draws the same wheel.
function eligibleMovies() {
  return movies.filter((m) => statusOf(m) === "pending");
}
const watchedThisWeek = () => movies.filter((m) => statusOf(m) === "watched");
const skippedThisWeek = () => movies.filter((m) => statusOf(m) === "skipped");

function render() {
  renderTally();
  renderMovieList();
  renderWheelState();
  seenFirstRender = true;
}

// A one-line account of where the night stands.
function renderTally() {
  const el = $("tally");
  if (!el) return;
  const w = watchedThisWeek().length;
  const s = skippedThisWeek().length;
  const p = eligibleMovies().length;
  const parts = [];
  if (w) parts.push(`✅ ${w} watched`);
  if (s) parts.push(`⏭ ${s} set aside`);
  parts.push(`🎯 ${p} on the wheel`);
  el.textContent = parts.join("  ·  ");
}

// Poster image, or a film-reel placeholder when we have no artwork.
function posterEl(url, cls) {
  if (!url) {
    const ph = document.createElement("div");
    ph.className = `${cls} placeholder`;
    ph.textContent = "🎬";
    return ph;
  }
  const img = document.createElement("img");
  img.className = cls;
  img.src = url;
  img.alt = "";
  img.loading = "lazy";
  return img;
}

function tag(text, cls) {
  const s = document.createElement("span");
  s.className = `badge ${cls}`;
  s.textContent = text;
  return s;
}

async function editNote(m) {
  const next = prompt(`Note for "${m.title}"\n(leave blank to remove)`, m.note || "");
  if (next === null) return; // cancelled
  const note = next.trim().slice(0, 140) || null;
  if (note === (m.note || null)) return;
  const { error } = await sb.from("movies").update({ note }).eq("id", m.id);
  if (error) alert(error.message);
  await reload();
}

// IMDb / Rotten Tomatoes badges, or null when we have neither.
function ratingsEl(m) {
  if (!m.imdb_rating && !m.rt_score) return null;
  const wrap = document.createElement("div");
  wrap.className = "ratings";
  if (m.imdb_rating) {
    const b = document.createElement("span");
    b.className = "badge imdb";
    b.textContent = `★ ${m.imdb_rating}`;
    b.title = "IMDb rating";
    wrap.appendChild(b);
  }
  if (m.rt_score) {
    const b = document.createElement("span");
    b.className = "badge rt";
    b.textContent = `🍅 ${m.rt_score}`;
    b.title = "Rotten Tomatoes";
    wrap.appendChild(b);
  }
  return wrap;
}

function renderMovieList() {
  const ul = $("movie-list");
  ul.innerHTML = "";
  if (movies.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-note";
    li.textContent = "No movies yet — add the first one!";
    ul.appendChild(li);
    return;
  }
  // On the wheel first, then set aside, then already watched.
  const rank = { pending: 0, skipped: 1, watched: 2 };
  const elig = eligibleMovies();
  const ordered = [...movies].sort(
    (a, b) => rank[statusOf(a)] - rank[statusOf(b)]
  );

  ordered.forEach((m) => {
    const st = statusOf(m);
    const idx = elig.findIndex((e) => e.id === m.id); // -1 once decided
    const li = document.createElement("li");
    li.className = `movie-item status-${st}`;
    // Match its wheel segment while it's still in play.
    li.style.borderLeftColor = idx >= 0 ? colorFor(idx) : "transparent";
    li.appendChild(posterEl(m.poster_url, "movie-poster"));
    const main = document.createElement("div");
    main.className = "movie-main";
    main.innerHTML = `<div class="movie-name"></div><div class="movie-owner"></div>`;
    main.querySelector(".movie-name").textContent = m.title;
    main.querySelector(".movie-owner").textContent =
      [m.year, m.runtime, playerName(m.owner_id)].filter(Boolean).join(" · ");

    const badges = ratingsEl(m) || document.createElement("div");
    badges.className = "ratings";
    if (st === "watched") badges.appendChild(tag("✅ watched", "watched"));
    if (st === "skipped") badges.appendChild(tag("⏭ set aside", "skipped"));
    if (m.carried_over) badges.appendChild(tag("↩ held over", "carried"));
    if (st === "pending" && findWatched(m)) badges.appendChild(tag("👁 seen before", "seen"));
    if (badges.childNodes.length) main.appendChild(badges);

    if (m.providers) {
      const p = document.createElement("div");
      p.className = "movie-providers";
      p.textContent = `🍿 ${m.providers}`;
      main.appendChild(p);
    }
    if (m.note) {
      const n = document.createElement("div");
      n.className = "movie-note";
      n.textContent = m.note;
      main.appendChild(n);
    }

    // Tapping the row adds or edits a note.
    main.style.cursor = "pointer";
    main.title = "Tap to add a note";
    main.onclick = () => editNote(m);

    li.appendChild(main);

    // Put a set-aside or already-watched movie back into play.
    if (st !== "pending") {
      const back = document.createElement("button");
      back.className = "movie-back";
      back.type = "button";
      back.textContent = "↩";
      back.title = "Put back on the wheel";
      back.setAttribute("aria-label", `Put ${m.title} back on the wheel`);
      back.onclick = () => setMovieStatus(m, "pending");
      li.appendChild(back);
    }

    const del = document.createElement("button");
    del.className = "movie-del";
    del.type = "button";
    del.textContent = "✕";
    del.title = "Remove this movie";
    del.setAttribute("aria-label", `Remove ${m.title}`);
    del.onclick = () => removeMovie(m.id, m.title);
    li.appendChild(del);
    ul.appendChild(li);
  });
}

// --- typeahead ----------------------------------------------------
let searchTimer = null;
let searchAbort = null;

function setupSearch() {
  const input = $("movie-title");
  if (!TMDB_KEY) {
    input.placeholder = "Add a movie…";
    return;
  }
  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(searchTimer);
    if (searchAbort) searchAbort.abort();
    if (q.length < 2) return closeResults();
    searchTimer = setTimeout(() => runSearch(q), 300);
  });
  // Close the dropdown when tapping elsewhere
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".add-wrap")) closeResults();
  });
}

async function runSearch(q) {
  searchAbort = new AbortController();
  const signal = searchAbort.signal;
  try {
    let results = await searchMovies(q, signal);
    if (!results.length) results = await searchOMDbTitles(q, signal); // fallback
    if ($("movie-title").value.trim() !== q) return; // stale
    renderResults(results, q);
  } catch (err) {
    if (err.name === "AbortError") return;
    // TMDB failed outright — try the other provider before giving up.
    try {
      const results = await searchOMDbTitles(q, signal);
      if ($("movie-title").value.trim() !== q) return;
      return renderResults(results, q);
    } catch (_) {}
    renderResults([], q, "Couldn't reach the movie database.");
  }
}

function closeResults() {
  $("search-results").classList.add("hidden");
  $("movie-title").setAttribute("aria-expanded", "false");
}

function renderResults(results, q, note) {
  const box = $("search-results");
  box.innerHTML = "";
  if (!results.length) {
    const p = document.createElement("div");
    p.className = "sr-note";
    p.textContent = note || `No matches. Tap Add to save “${q}” as typed.`;
    box.appendChild(p);
  }
  results.forEach((r) => {
    const b = document.createElement("button");
    b.className = "sr-item";
    b.type = "button";
    b.setAttribute("role", "option");
    if (r.poster_url) {
      const img = document.createElement("img");
      img.className = "sr-poster";
      img.src = r.poster_url;
      img.alt = "";
      img.loading = "lazy";
      b.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "sr-poster placeholder";
      ph.textContent = "🎬";
      b.appendChild(ph);
    }
    const main = document.createElement("div");
    main.className = "sr-main";
    main.innerHTML = `<div class="sr-title"></div><div class="sr-year"></div>`;
    main.querySelector(".sr-title").textContent = r.title;
    main.querySelector(".sr-year").textContent = r.year || "";
    b.appendChild(main);
    b.onclick = () => addMovie(r);
    box.appendChild(b);
  });
  box.classList.remove("hidden");
  $("movie-title").setAttribute("aria-expanded", "true");
}

// --- adding -------------------------------------------------------
async function onAddMovie(e) {
  e.preventDefault();
  const title = $("movie-title").value.trim();
  if (!title) return;
  // Submitting the form saves exactly what was typed.
  addMovie({ title });
}

async function addMovie(pick) {
  clearTimeout(searchTimer);
  if (searchAbort) searchAbort.abort();
  $("movie-title").value = "";
  closeResults();

  const seen = findWatched(pick);
  if (seen) {
    const when = prettyWeek(parseYmd(seen.week));
    if (!confirm(`You already watched "${seen.title}" — ${when}.\n\nAdd it again anyway?`)) return;
  }

  const row = {
    title: pick.title,
    owner_id: me.id,
    week_start: CUR_WEEK,
    year: pick.year || null,
    poster_url: pick.poster_url || null,
    tmdb_id: pick.tmdb_id || null,
    imdb_id: pick.imdb_id || null,
  };
  const { data, error } = await sb.from("movies").insert(row).select("*").maybeSingle();
  if (error) {
    alert(error.message);
    return;
  }
  await reload(); // show it right away…

  // …then fill in ratings (and any missing artwork) in the background.
  if (!data) return;
  const details = await fetchDetails(pick);
  const patch = Object.fromEntries(Object.entries(details).filter(([, v]) => v));
  if (!Object.keys(patch).length) return;
  await sb.from("movies").update(patch).eq("id", data.id);
  await reload();
}

async function removeMovie(id, title) {
  if (!confirm(`Remove "${title}" from this week?`)) return;
  const { error } = await sb.from("movies").delete().eq("id", id);
  if (error) alert(error.message);
  await reload();
}

// ------------------------------------------------------------------
// Wheel drawing + spin
// ------------------------------------------------------------------
const canvas = $("wheel");
const ctx = canvas.getContext("2d");
const R = canvas.width / 2;

function drawWheel(rot) {
  const elig = eligibleMovies();
  const n = elig.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(R, R);

  if (n === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, R - 6, 0, TWO_PI);
    ctx.fillStyle = "#241c3d";
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.rotate(rot);
  const seg = TWO_PI / n;
  for (let i = 0; i < n; i++) {
    const a0 = i * seg;
    const a1 = a0 + seg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R - 6, a0, a1);
    ctx.closePath();
    ctx.fillStyle = colorFor(i);
    ctx.fill();

    // label
    ctx.save();
    ctx.rotate(a0 + seg / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,.8)";
    ctx.font = `600 ${Math.max(13, Math.min(22, 300 / n + 8))}px -apple-system, system-ui, sans-serif`;
    let label = elig[i].title;
    const max = n > 8 ? 14 : 18;
    if (label.length > max) label = label.slice(0, max - 1) + "…";
    ctx.fillText(label, R - 26, 0);
    ctx.restore();
  }
  // hub
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.14, 0, TWO_PI);
  ctx.fillStyle = "#0e0b16";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ffd76b";
  ctx.stroke();
  ctx.restore();
}

function finalRotationFor(winIndex, n, from) {
  const seg = TWO_PI / n;
  const center = (winIndex + 0.5) * seg;
  const base = -Math.PI / 2 - center; // put winner center under the top pointer
  const minTurns = 6;
  let final = base;
  final += Math.ceil((from + minTurns * TWO_PI - base) / TWO_PI) * TWO_PI;
  return final;
}

function renderWheelState() {
  const elig = eligibleMovies();
  $("wheel-empty").classList.toggle("hidden", elig.length > 0);

  if (openSpin) {
    // The wheel stopped on something and nobody has said what happened yet.
    const idx = elig.findIndex((m) => m.id === openSpin.winning_movie_id);
    if (idx >= 0 && lastAnimatedSpinId !== openSpin.id && !animating && seenFirstRender) {
      // A spin landed while we're watching → animate to it. The result stays
      // hidden until the wheel stops; animateToWinner reveals it at the end.
      animateToWinner(idx, elig.length, openSpin.id);
      return;
    }
    if (idx >= 0) {
      // We just opened the app mid-decision: sit at the result.
      lastAnimatedSpinId = openSpin.id;
      rotation = finalRotationFor(idx, elig.length, rotation) % TWO_PI;
    }
    drawWheel(rotation);
    if (animating) return; // spin still in flight — don't reveal early
    settleOnResult();
    return;
  }

  hide("result");
  drawWheel(rotation);
  const canSpin = elig.length >= 1 && !animating;
  const watched = watchedThisWeek().length;
  $("spin-btn").disabled = !canSpin;
  $("spin-btn").textContent = watched ? "Spin again" : "Spin the wheel";
  if (elig.length === 0) {
    $("spin-note").textContent = movies.length
      ? "Every movie has been decided — add another, or put one back on the wheel."
      : "Add movies to spin.";
  } else {
    $("spin-note").textContent =
      `${elig.length} movie${elig.length > 1 ? "s" : ""} on the wheel` +
      (watched ? ` · ${watched} watched so far` : "");
  }
}

function showResult() {
  if (!openSpin) return hide("result");
  const el = $("result");
  el.innerHTML = `
    <div class="win-tag">The wheel landed on</div>
    <div class="win-title"></div>
    <div class="win-owner"></div>`;

  const poster = openSpin.winning_poster_url;
  if (poster) el.insertBefore(posterEl(poster, "win-poster"), el.children[1]);

  el.querySelector(".win-title").textContent = openSpin.winning_title || "—";
  el.querySelector(".win-owner").textContent = [
    openSpin.winning_year,
    openSpin.winner_name ? `${openSpin.winner_name}'s pick` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Pull ratings off the movie itself if it's still in this week's list.
  const won = movies.find((m) => m.id === openSpin.winning_movie_id);
  const badges = won ? ratingsEl(won) : null;
  if (badges) el.appendChild(badges);

  if (won && (won.runtime || won.providers)) {
    const extra = document.createElement("div");
    extra.className = "win-extra";
    extra.textContent = [won.runtime, won.providers && `🍿 ${won.providers}`]
      .filter(Boolean)
      .join(" · ");
    el.appendChild(extra);
  }
  if (openSpin.spun_by_name) {
    const by = document.createElement("div");
    by.className = "win-spun";
    by.textContent = `spun by ${openSpin.spun_by_name}`;
    el.appendChild(by);
  }

  // Nothing moves until someone says what actually happened.
  const ask = document.createElement("div");
  ask.className = "win-ask";
  ask.textContent = "Are we watching it?";
  el.appendChild(ask);

  const actions = document.createElement("div");
  actions.className = "win-actions";
  const yes = document.createElement("button");
  yes.className = "btn primary";
  yes.type = "button";
  yes.textContent = "✅ We watched it";
  yes.onclick = () => decideSpin("watched");
  const no = document.createElement("button");
  no.className = "btn";
  no.type = "button";
  no.textContent = "⏭ Not this one";
  no.onclick = () => decideSpin("skipped");
  actions.append(yes, no);
  el.appendChild(actions);

  show("result");
}

// Record what happened to the movie the wheel stopped on. 'watched' takes it
// out of the running for good; 'skipped' sets it aside but keeps it for next
// week, since it never actually got watched.
async function decideSpin(outcome) {
  if (!openSpin) return;
  const spinId = openSpin.id;
  const movieId = openSpin.winning_movie_id;
  const el = $("result");
  el.querySelectorAll("button").forEach((b) => (b.disabled = true));

  if (movieId) {
    const patch =
      outcome === "watched"
        ? { status: "watched", watched_at: new Date().toISOString() }
        : { status: "skipped" };
    const { error } = await sb.from("movies").update(patch).eq("id", movieId);
    if (error) {
      alert(error.message);
      el.querySelectorAll("button").forEach((b) => (b.disabled = false));
      return;
    }
  }
  await sb
    .from("spins")
    .update({ outcome, decided_by_name: me.name })
    .eq("id", spinId);
  await reload();
}

async function setMovieStatus(m, status) {
  const patch = { status };
  if (status !== "watched") patch.watched_at = null;
  const { error } = await sb.from("movies").update(patch).eq("id", m.id);
  if (error) return alert(error.message);
  await reload();
}

async function onSpin() {
  const elig = eligibleMovies();
  if (elig.length === 0 || animating || openSpin) return;
  const winIndex = Math.floor(Math.random() * elig.length);
  const w = elig[winIndex];
  const row = {
    week_start: CUR_WEEK,
    winning_movie_id: w.id,
    winner_player_id: w.owner_id,
    winning_title: w.title,
    winner_name: playerName(w.owner_id),
    winning_poster_url: w.poster_url || null,
    winning_year: w.year || null,
    spun_by_id: me.id,
    spun_by_name: me.name,
  };
  $("spin-btn").disabled = true;
  let { data, error } = await sb.from("spins").insert(row).select("*").maybeSingle();
  if (error && /column|schema cache/i.test(error.message || "")) {
    // Attribution columns aren't in the database yet — spin without them
    // rather than blocking the spin entirely.
    const { spun_by_id, spun_by_name, ...base } = row;
    ({ data, error } = await sb.from("spins").insert(base).select("*").maybeSingle());
  }
  if (error) {
    // Someone else spun at the same moment — pick up their result instead.
    await reload();
    return;
  }
  openSpin = data;
  weekSpins = [...weekSpins, data];
  render(); // animates, then reveals the result
}

function animateToWinner(winIndex, n, spinId) {
  lastAnimatedSpinId = spinId;
  // Nobody is watching a backgrounded tab, and animation frames don't run
  // there — settle on the result instead of sitting on "Spinning…".
  if (document.hidden) {
    rotation = finalRotationFor(winIndex, n, rotation) % TWO_PI;
    drawWheel(rotation);
    animating = false;
    settleOnResult();
    return;
  }
  animating = true;
  // Keep the winner secret until the wheel comes to rest.
  hide("result");
  $("spin-btn").disabled = true;
  $("spin-btn").textContent = "Spinning…";
  $("spin-note").textContent = "🥁 And the winner is…";
  const start = rotation;
  const end = finalRotationFor(winIndex, n, start);
  const dur = 4600;
  const t0 = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function frame(now) {
    const t = Math.min(1, (now - t0) / dur);
    rotation = start + (end - start) * ease(t);
    drawWheel(rotation);
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      rotation = end % TWO_PI;
      animating = false;
      settleOnResult();
    }
  }
  requestAnimationFrame(frame);
}

// Reveal what the wheel landed on and wait for the verdict.
function settleOnResult() {
  showResult();
  $("spin-btn").disabled = true;
  $("spin-btn").textContent = "Spin again";
  $("spin-note").textContent = "Say whether you watched it to keep going.";
}

// ------------------------------------------------------------------
// Realtime
// ------------------------------------------------------------------
function subscribeRealtime() {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  realtimeChannel = sb
    .channel("movie-roulette")
    .on("postgres_changes", { event: "*", schema: "public", table: "movies" }, onRemoteChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "players" }, onRemoteChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "spins" }, onRemoteChange)
    .subscribe();
}

let reloadQueued = false;
async function onRemoteChange() {
  if (animating) return; // don't interrupt a spin in progress
  if (reloadQueued) return;
  reloadQueued = true;
  setTimeout(async () => {
    reloadQueued = false;
    await reloadDataOnly();
    // If a spin just landed, render() animates to it.
    render();
  }, 150);
}

async function reloadDataOnly() {
  const [pRes, mRes, sRes] = await Promise.all([
    sb.from("players").select("id,name").order("name"),
    sb.from("movies").select("*").eq("week_start", CUR_WEEK).order("created_at"),
    sb.from("spins").select("*").eq("week_start", CUR_WEEK).order("created_at"),
  ]);
  players = pRes.data || [];
  movies = mRes.data || [];
  weekSpins = sRes.data || [];
  // Only the newest undecided spin needs a call; older ones are settled.
  openSpin = [...weekSpins].reverse().find((s) => (s.outcome || "pending") === "pending") || null;
}

// ------------------------------------------------------------------
// Installability + offline
// ------------------------------------------------------------------
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

function setupInstall() {
  const section = $("install-section");
  const btn = $("install-btn");
  const help = $("install-help");
  if (isStandalone()) return; // already installed — nothing to offer

  // Chrome/Android hands us the prompt; we save it for the menu button.
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    section.classList.remove("hidden");
    btn.classList.remove("hidden");
  });
  btn.onclick = async () => {
    if (!deferred) return;
    btn.disabled = true;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    btn.disabled = false;
    if (outcome === "accepted") section.classList.add("hidden");
  };
  window.addEventListener("appinstalled", () => section.classList.add("hidden"));

  // iOS has no prompt API — Safari can only be told how to do it by hand.
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) {
    help.textContent = "Tap the Share button, then “Add to Home Screen”.";
    section.classList.remove("hidden");
  }
}

function setupOfflineBanner() {
  const bar = $("offline-bar");
  const sync = () => bar.classList.toggle("hidden", navigator.onLine);
  window.addEventListener("online", () => {
    sync();
    reload(); // catch up on anything missed while disconnected
  });
  window.addEventListener("offline", sync);
  sync();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const go = () =>
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* offline support is a bonus; the app works fine without it */
    });
  // Hold off until the page has settled so it doesn't compete with the first
  // render — but this module imports from a CDN and frequently runs *after*
  // load has already fired, in which case the listener would never run.
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}

// ------------------------------------------------------------------
// Go
// ------------------------------------------------------------------
drawWheel(0);
setupInstall();
setupOfflineBanner();
registerServiceWorker();
initGate();
