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
const prevMonday = new Date(nowMonday);
prevMonday.setDate(prevMonday.getDate() - 7);
const PREV_WEEK = ymd(prevMonday);

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
let excludedPlayerId = null; // won last week → sits out this week
let rotation = 0; // current wheel rotation (radians)
let animating = false;
let lastAnimatedSpinId = null;

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

  await reload();
  subscribeRealtime();
}

// ------------------------------------------------------------------
// Menu / reset
// ------------------------------------------------------------------
function openMenu() {
  $("reset-pass").value = "";
  $("reset-msg").className = "small hidden";
  $("menu").classList.remove("hidden");
}
function closeMenu() {
  $("menu").classList.add("hidden");
}
function setupMenu() {
  $("menu-btn").onclick = openMenu;
  $("menu-close").onclick = closeMenu;
  $("menu-backdrop").onclick = closeMenu;
  $("reset-form").onsubmit = onReset;
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

async function reload() {
  const [pRes, mRes, sRes, prevRes] = await Promise.all([
    sb.from("players").select("id,name").order("name"),
    sb.from("movies").select("*").eq("week_start", CUR_WEEK).order("created_at"),
    sb.from("spins").select("*").eq("week_start", CUR_WEEK).maybeSingle(),
    sb.from("spins").select("winner_player_id").eq("week_start", PREV_WEEK).maybeSingle(),
  ]);
  players = pRes.data || [];
  movies = mRes.data || [];
  spin = sRes.data || null;
  excludedPlayerId = prevRes.data ? prevRes.data.winner_player_id : null;
  render();
}

function playerName(id) {
  const p = players.find((x) => x.id === id);
  return p ? p.name : "Someone";
}

// Movies eligible for the wheel (stable order = same for everyone)
function eligibleMovies() {
  return movies.filter((m) => m.owner_id !== excludedPlayerId);
}

function render() {
  renderSittingOut();
  renderMovieList();
  renderWheelState();
}

function renderSittingOut() {
  const el = $("sitting-out");
  if (excludedPlayerId) {
    el.textContent = `🚫 ${playerName(excludedPlayerId)} sits out this week (won last week)`;
  } else {
    el.textContent = "";
  }
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
  const elig = eligibleMovies();
  movies.forEach((m) => {
    const idx = elig.findIndex((e) => e.id === m.id);
    const li = document.createElement("li");
    li.className = "movie-item" + (idx === -1 ? " excluded" : "");
    const dot = document.createElement("span");
    dot.className = "movie-dot";
    dot.style.background = idx === -1 ? "#555" : colorFor(idx);
    const main = document.createElement("div");
    main.className = "movie-main";
    main.innerHTML = `<div class="movie-name"></div><div class="movie-owner"></div>`;
    main.querySelector(".movie-name").textContent = m.title;
    main.querySelector(".movie-owner").textContent =
      playerName(m.owner_id) + (m.owner_id === excludedPlayerId ? " · sitting out" : "");
    li.appendChild(dot);
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

async function onAddMovie(e) {
  e.preventDefault();
  const input = $("movie-title");
  const title = input.value.trim();
  if (!title) return;
  input.value = "";
  const { error } = await sb
    .from("movies")
    .insert({ title, owner_id: me.id, week_start: CUR_WEEK });
  if (error) alert(error.message);
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
    if (idx >= 0 && lastAnimatedSpinId !== spin.id && !animating) {
      // freshly observed spin → animate to it
      animateToWinner(idx, elig.length, spin.id);
    } else if (idx >= 0 && lastAnimatedSpinId === spin.id) {
      rotation = finalRotationFor(idx, elig.length, rotation) % TWO_PI;
      drawWheel(rotation);
    } else if (idx < 0) {
      drawWheel(rotation);
    }
    showResult();
    $("spin-btn").disabled = true;
    $("spin-btn").textContent = "Spun for this week 🎉";
    $("spin-note").textContent = "Come back next week for another spin.";
    return;
  }

  hide("result");
  drawWheel(rotation);
  const canSpin = elig.length >= 1 && !animating;
  $("spin-btn").disabled = !canSpin;
  $("spin-btn").textContent = "Spin the wheel";
  if (elig.length === 0) {
    $("spin-note").textContent = movies.length
      ? "Everyone with movies is sitting out this week."
      : "Add movies to spin.";
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
  el.querySelector(".win-title").textContent = spin.winning_title || "—";
  el.querySelector(".win-owner").textContent = spin.winner_name
    ? `${spin.winner_name}'s pick · sits out next week`
    : "";
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
  };
  $("spin-btn").disabled = true;
  const { data, error } = await sb.from("spins").insert(row).select("*").maybeSingle();
  if (error) {
    // Someone else spun first (unique week) — load their result
    await reload();
    return;
  }
  spin = data;
  render(); // realtime + this will animate for us
}

function animateToWinner(winIndex, n, spinId) {
  animating = true;
  lastAnimatedSpinId = spinId;
  $("spin-btn").disabled = true;
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
      showResult();
      $("spin-btn").textContent = "Spun for this week 🎉";
      $("spin-note").textContent = "Come back next week for another spin.";
    }
  }
  requestAnimationFrame(frame);
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
  const [pRes, mRes, sRes, prevRes] = await Promise.all([
    sb.from("players").select("id,name").order("name"),
    sb.from("movies").select("*").eq("week_start", CUR_WEEK).order("created_at"),
    sb.from("spins").select("*").eq("week_start", CUR_WEEK).maybeSingle(),
    sb.from("spins").select("winner_player_id").eq("week_start", PREV_WEEK).maybeSingle(),
  ]);
  players = pRes.data || [];
  movies = mRes.data || [];
  spin = sRes.data || null;
  excludedPlayerId = prevRes.data ? prevRes.data.winner_player_id : null;
}

// ------------------------------------------------------------------
// Go
// ------------------------------------------------------------------
drawWheel(0);
initGate();
