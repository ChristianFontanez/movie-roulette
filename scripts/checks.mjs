// Pre-flight checks for the web app.
//
// Runs in CI on every push, and locally with `node scripts/checks.mjs`.
// Everything here is cheap and dependency-free on purpose: this app has no
// build step, and the checks shouldn't become one.
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const p = (f) => path.join(ROOT, f);
const read = (f) => fs.readFileSync(p(f), "utf8");

let failed = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const bad = (msg) => {
  console.log(`  ❌ ${msg}`);
  failed++;
};

function check(name, fn) {
  console.log(`\n${name}`);
  try {
    fn();
  } catch (e) {
    bad(e.message);
  }
}

// 1. The JavaScript actually parses --------------------------------
check("Syntax", () => {
  // app.js is a module: strip the import so it can be parsed standalone.
  const app = read("app.js").replace(/^import .*$/m, "");
  new Function(app);
  ok("app.js parses");
  new Function(read("sw.js"));
  ok("sw.js parses");
});

// 2. The manifest is valid and complete ----------------------------
let manifest;
check("Manifest", () => {
  manifest = JSON.parse(read("manifest.webmanifest"));
  ok("manifest.webmanifest is valid JSON");
  for (const key of ["name", "start_url", "display", "icons"]) {
    if (!manifest[key]) bad(`manifest is missing "${key}"`);
  }
  if (manifest.icons?.length) ok(`${manifest.icons.length} icons declared`);
  // Installability needs a 192 and a 512, and launchers need a maskable one.
  const sizes = manifest.icons.map((i) => i.sizes);
  for (const need of ["192x192", "512x512"]) {
    if (!sizes.includes(need)) bad(`no ${need} icon — browsers won't offer to install`);
  }
  if (!manifest.icons.some((i) => (i.purpose || "").includes("maskable"))) {
    bad("no maskable icon — Android will letterbox the icon");
  } else ok("maskable icon present");
});

// 3. Everything referenced actually exists -------------------------
check("Referenced files exist", () => {
  const missing = [];
  for (const icon of manifest?.icons ?? []) {
    if (!fs.existsSync(p(icon.src))) missing.push(icon.src);
  }
  // The service worker precaches a list; a typo there breaks offline silently.
  const shell = [...read("sw.js").matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
  for (const f of shell) {
    if (f && !fs.existsSync(p(f))) missing.push(`sw.js precache: ${f}`);
  }
  // Local scripts, styles, and icons the page links to.
  const html = read("index.html");
  for (const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
    const f = m[1];
    if (f.startsWith("http") || f.startsWith("data:") || f.startsWith("mailto")) continue;
    if (!fs.existsSync(p(f))) missing.push(`index.html: ${f}`);
  }
  if (missing.length) missing.forEach((f) => bad(`missing: ${f}`));
  else ok("every referenced file is present");
});

// 4. Config is filled in -------------------------------------------
check("Config", () => {
  const cfg = read("config.js");
  const placeholders = [...cfg.matchAll(/__([A-Z_]+)__/g)].map((m) => m[0]);
  if (placeholders.length) bad(`unfilled placeholders: ${placeholders.join(", ")}`);
  else ok("no unfilled placeholders");
  if (/sb_secret_/.test(cfg)) bad("a Supabase SECRET key is in config.js — it must never ship");
  else ok("no secret key in config.js");
});

// 5. Notes don't rot ------------------------------------------------
check("Docs", () => {
  const files = [...fs.readdirSync(p("docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`), "ROADMAP.md"];
  const names = new Set(files.map((f) => path.basename(f, ".md")));
  const broken = [];
  for (const f of files) {
    const body = read(f);
    // Ignore links inside backticks — those are examples, not links.
    for (const m of body.matchAll(/(?<!`)\[\[([^\]|#]+)\]\](?!`)/g)) {
      if (!names.has(m[1].trim())) broken.push(`${path.basename(f)} → [[${m[1].trim()}]]`);
    }
  }
  if (broken.length) broken.forEach((b) => bad(`broken wikilink: ${b}`));
  else ok(`${files.length} notes, all wikilinks resolve`);
});

console.log(failed ? `\n${failed} check(s) failed\n` : "\nAll checks passed\n");
process.exit(failed ? 1 : 0);
