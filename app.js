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
let spin = null; // this week's spin row (or null)
let rotation = 0; // current wheel rotation (radians)
let animating = false;
let lastAnimatedSpinId = null;
// A spin already on the books when we open the app is shown at rest; only a
// spin that lands while we're watching gets the suspense animation.
let seenFirstRender = false;

// ------------------------------------------------------------------
// Passphrase gate
// ------------------------------------------------------------------
async function getStoredHash() {
  const { data } = await sb
    .from("app_config")
    .select("value")
    .eq("key", "passphrase_hash")
    .maybeSingle();
  return data ? data.value : null;
}

async function initGate() {
  const stored = await getStoredHash();
  const gateSub = $("gate-sub");
  const err = $("gate-error");
  err.classList.add("hidden");

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
      const { error } = await sb
        .from("app_config")
        .upsert({ key: "passphrase_hash", value: hash });
      if (error) return showErr(err, error.message);
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

async function loadWatched() {
  const { data } = await sb
    .from("spins")
    .select("winning_title,winning_movie_id,week_start")
    .lt("week_start", CUR_WEEK)
    .order("week_start", { ascending: false });
  if (!data) return;
  // Resolve each winner's imdb_id so re-adds match even when the title
  // is typed differently ("Kung fu hustle" vs "Kungfu Hustle").
  const ids = data.map((s) => s.winning_movie_id).filter(Boolean);
  let byId = {};
  if (ids.length) {
    const { data: rows } = await sb.from("movies").select("id,imdb_id").in("id", ids);
    (rows || []).forEach((r) => (byId[r.id] = r.imdb_id));
  }
  watched = data.map((s) => ({
    title: s.winning_title,
    key: normTitle(s.winning_title),
    imdb_id: byId[s.winning_movie_id] || null,
    week: s.week_start,
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

  const { data: spins, error } = await sb
    .from("spins")
    .select("*")
    .lt("week_start", CUR_WEEK)
    .order("week_start", { ascending: false });
  if (error) {
    box.innerHTML = "";
    box.appendChild(noteEl(error.message));
    return;
  }
  if (!spins || !spins.length) {
    box.innerHTML = "";
    box.appendChild(noteEl("No past picks yet — this is your first week!"));
    return;
  }

  // Pull the winning movie rows for posters/ratings the spin didn't store,
  // plus everything else that was on those wheels.
  const weeks = spins.map((s) => s.week_start);
  const { data: past } = await sb
    .from("movies")
    .select("*")
    .in("week_start", weeks)
    .order("created_at");
  const byWeek = {};
  (past || []).forEach((m) => (byWeek[m.week_start] = byWeek[m.week_start] || []).push(m));

  box.innerHTML = "";
  spins.forEach((s) => box.appendChild(historyRow(s, byWeek[s.week_start] || [])));
}

function noteEl(text) {
  const d = document.createElement("div");
  d.className = "sr-note";
  d.textContent = text;
  return d;
}

function historyRow(s, weekMovies) {
  const won = weekMovies.find((m) => m.id === s.winning_movie_id);
  const row = document.createElement("div");
  row.className = "hist-item";

  row.appendChild(posterEl(s.winning_poster_url || (won && won.poster_url), "hist-poster"));

  const main = document.createElement("div");
  main.className = "hist-main";
  main.innerHTML = `<div class="hist-week"></div><div class="hist-title"></div><div class="hist-who"></div>`;
  main.querySelector(".hist-week").textContent = prettyWeek(parseYmd(s.week_start));
  main.querySelector(".hist-title").textContent = s.winning_title || "—";
  main.querySelector(".hist-who").textContent = [
    s.winning_year || (won && won.year),
    s.winner_name ? `${s.winner_name}'s pick` : null,
    s.spun_by_name ? `spun by ${s.spun_by_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const badges = won ? ratingsEl(won) : null;
  if (badges) main.appendChild(badges);

  // The rest of that week's wheel, for context on what it beat.
  const others = weekMovies.filter((m) => m.id !== s.winning_movie_id);
  if (others.length) {
    const also = document.createElement("div");
    also.className = "hist-also";
    also.textContent = `also on the wheel: ${others.map((m) => m.title).join(", ")}`;
    main.appendChild(also);
  }

  row.appendChild(main);
  return row;
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
  if (!stored || hash !== stored) {
    msg.textContent = "That passphrase doesn't match.";
    msg.className = "small bad";
    return;
  }

  const { error } = await sb.from("spins").delete().eq("week_start", CUR_WEEK);
  if (error) {
    msg.textContent = error.message;
    msg.className = "small bad";
    return;
  }
  lastAnimatedSpinId = null;
  $("reset-pass").value = "";
  await reload();
  msg.textContent = "Done — the wheel is ready to spin again!";
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

  const [{ data: prevMovies }, { data: prevSpin }] = await Promise.all([
    sb.from("movies").select("*").eq("week_start", PREV_WEEK).order("created_at"),
    sb.from("spins").select("winning_movie_id").eq("week_start", PREV_WEEK).maybeSingle(),
  ]);
  if (!prevMovies || !prevMovies.length) return false;

  const wonId = prevSpin ? prevSpin.winning_movie_id : null;
  const rollovers = prevMovies
    .filter((m) => m.id !== wonId)
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
    }));
  if (!rollovers.length) return false;

  const { error } = await sb.from("movies").insert(rollovers);
  return !error;
}

async function reload() {
  await reloadDataOnly();
  render();
}

function playerName(id) {
  const p = players.find((x) => x.id === id);
  return p ? p.name : "Someone";
}

// Movies on the wheel (stable order = same for everyone)
function eligibleMovies() {
  return movies;
}

function render() {
  renderMovieList();
  renderWheelState();
  seenFirstRender = true;
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
  movies.forEach((m, idx) => {
    const li = document.createElement("li");
    li.className = "movie-item";
    li.style.borderLeftColor = colorFor(idx); // matches its wheel segment
    li.appendChild(posterEl(m.poster_url, "movie-poster"));
    const main = document.createElement("div");
    main.className = "movie-main";
    main.innerHTML = `<div class="movie-name"></div><div class="movie-owner"></div>`;
    main.querySelector(".movie-name").textContent = m.title;
    main.querySelector(".movie-owner").textContent =
      [m.year, m.runtime, playerName(m.owner_id)].filter(Boolean).join(" · ");

    const badges = ratingsEl(m) || document.createElement("div");
    badges.className = "ratings";
    if (m.carried_over) badges.appendChild(tag("↩ held over", "carried"));
    if (findWatched(m)) badges.appendChild(tag("👁 seen before", "seen"));
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

  if (spin) {
    // Resolve the winning movie's index in the eligible order
    const idx = elig.findIndex((m) => m.id === spin.winning_movie_id);
    if (idx >= 0 && lastAnimatedSpinId !== spin.id && !animating && seenFirstRender) {
      // A spin landed while we're watching → animate to it. The result stays
      // hidden until the wheel stops; animateToWinner reveals it at the end.
      animateToWinner(idx, elig.length, spin.id);
      return;
    }
    if (idx >= 0) {
      // Already-decided week (or we just opened the app): sit at the result.
      lastAnimatedSpinId = spin.id;
      rotation = finalRotationFor(idx, elig.length, rotation) % TWO_PI;
      drawWheel(rotation);
    } else if (idx < 0) {
      drawWheel(rotation);
    }
    if (animating) return; // spin still in flight — don't reveal early
    settleOnResult();
    return;
  }

  hide("result");
  drawWheel(rotation);
  const canSpin = elig.length >= 1 && !animating;
  $("spin-btn").disabled = !canSpin;
  $("spin-btn").textContent = "Spin the wheel";
  if (elig.length === 0) {
    $("spin-note").textContent = "Add movies to spin.";
  } else {
    $("spin-note").textContent = `${elig.length} movie${elig.length > 1 ? "s" : ""} on the wheel`;
  }
}

function showResult() {
  if (!spin) return hide("result");
  const el = $("result");
  el.innerHTML = `
    <div class="win-tag">This week we're watching</div>
    <div class="win-title"></div>
    <div class="win-owner"></div>`;

  const poster = spin.winning_poster_url;
  if (poster) el.insertBefore(posterEl(poster, "win-poster"), el.children[1]);

  el.querySelector(".win-title").textContent = spin.winning_title || "—";
  el.querySelector(".win-owner").textContent = [
    spin.winning_year,
    spin.winner_name ? `${spin.winner_name}'s pick` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Pull ratings off the winning movie if it's still in this week's list.
  const won = movies.find((m) => m.id === spin.winning_movie_id);
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
  if (spin.spun_by_name) {
    const by = document.createElement("div");
    by.className = "win-spun";
    by.textContent = `spun by ${spin.spun_by_name}`;
    el.appendChild(by);
  }

  show("result");
}

async function onSpin() {
  const elig = eligibleMovies();
  if (elig.length === 0 || animating || spin) return;
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
    // Someone else spun first (unique week) — load their result
    await reload();
    return;
  }
  spin = data;
  render(); // realtime + this will animate for us
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

// Reveal the winner and put the controls in their "already spun" state.
function settleOnResult() {
  showResult();
  $("spin-btn").disabled = true;
  $("spin-btn").textContent = "Spun for this week 🎉";
  $("spin-note").textContent = "Come back next week for another spin.";
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
    const wasSpun = !!spin;
    await reloadDataOnly();
    // If a spin just appeared and we haven't animated it, animate now
    render();
    void wasSpun;
  }, 150);
}

async function reloadDataOnly() {
  const [pRes, mRes, sRes] = await Promise.all([
    sb.from("players").select("id,name").order("name"),
    sb.from("movies").select("*").eq("week_start", CUR_WEEK).order("created_at"),
    sb.from("spins").select("*").eq("week_start", CUR_WEEK).maybeSingle(),
  ]);
  players = pRes.data || [];
  movies = mRes.data || [];
  spin = sRes.data || null;
}

// ------------------------------------------------------------------
// Go
// ------------------------------------------------------------------
drawWheel(0);
initGate();
