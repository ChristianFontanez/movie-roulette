// Boots the real app in a real browser and asserts it comes up.
//
// The static checks can't catch a runtime error on load — this can. It's the
// difference between "the file parses" and "the app actually starts".
//
//   node scripts/smoke.mjs            (expects playwright installed)
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 8799;
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const file = path.join(ROOT, url === "/" ? "index.html" : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "text/plain" });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage();

const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

let failed = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m) => {
  console.log(`  ❌ ${m}`);
  failed++;
};

await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "load" });
// Give the CDN import and the first Supabase round-trip time to finish.
await page.waitForTimeout(5000);

console.log("\nBoot");
if (pageErrors.length) pageErrors.forEach((e) => bad(`uncaught error: ${e}`));
else ok("no uncaught exceptions");

// Network failures are the CI runner's problem, not the app's. Only flag
// errors the app itself logged.
const appErrors = consoleErrors.filter(
  (e) => !/Failed to load resource|net::|ERR_|status of 4\d\d|status of 5\d\d/i.test(e)
);
if (appErrors.length) appErrors.forEach((e) => bad(`console error: ${e}`));
else ok("no unexpected console errors");

console.log("\nRenders");
// Exactly one screen should be showing, and it must not be the config error.
const screens = await page.evaluate(() =>
  ["gate", "whoami", "app", "boot-error"].filter(
    (id) => !document.getElementById(id).classList.contains("hidden")
  )
);
if (screens.length !== 1) bad(`expected exactly one visible screen, saw: ${screens.join(", ") || "none"}`);
else ok(`showing the "${screens[0]}" screen`);
if (screens.includes("boot-error")) bad("app booted into its config-error state");

// The wheel must have drawn something, not sat as a blank canvas.
const wheelPainted = await page.evaluate(() => {
  const c = document.getElementById("wheel");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
  return false;
});
wheelPainted ? ok("wheel canvas painted") : bad("wheel canvas is blank");

await browser.close();
server.close();
console.log(failed ? `\n${failed} smoke check(s) failed\n` : "\nSmoke test passed\n");
process.exit(failed ? 1 : 0);
