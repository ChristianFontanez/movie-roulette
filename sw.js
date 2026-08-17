// Movie Roulette service worker.
//
// Guiding rule: an installed app must never be *worse* than the website. The
// biggest risk with a service worker is pinning everyone to a stale build, so
// the app shell is network-first — online you always get what was just pushed,
// and the cache exists purely so the app opens without a connection.
//
// Bump VERSION to retire old caches.
const VERSION = "v1";
const SHELL_CACHE = `mr-shell-${VERSION}`;
const IMAGE_CACHE = `mr-img-${VERSION}`;
const MAX_IMAGES = 120;

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Poster art. Immutable once published, so it's safe to serve from cache.
const IMAGE_HOSTS = ["image.tmdb.org", "m.media-amazon.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 404 can't fail the whole install.
      .then((c) => Promise.allSettled(SHELL.map((url) => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== IMAGE_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

// Fresh when possible, cached when not.
async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (_) {
    const hit = await cache.match(request);
    if (hit) return hit;
    // A navigation with nothing cached for that exact URL still deserves the
    // app shell rather than the browser's offline dinosaur.
    if (request.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    throw new Error("offline and uncached");
  }
}

// Posters: instant from cache, refreshed quietly in the background.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(request);
  const update = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === "opaque")) {
        cache.put(request, res.clone()).then(() => trimCache(IMAGE_CACHE, MAX_IMAGES));
      }
      return res;
    })
    .catch(() => null);
  return hit || update.then((r) => r || Promise.reject(new Error("no image")));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever touch reads. Anything that changes data — adding a movie,
  // recording a spin — goes straight to the network, untouched.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (IMAGE_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  // Supabase, TMDB, OMDb: never intercepted. Stale movie data would be worse
  // than no data, and realtime needs a live connection anyway.
});
