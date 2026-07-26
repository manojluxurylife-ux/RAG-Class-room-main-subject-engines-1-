// Runs automatically before every `next build` (see package.json's
// "prebuild" script — npm runs this hook for you, no extra step needed
// in the Netlify build command).
//
// WHY THIS EXISTS: public/sw.js caches JS/CSS assets cache-first,
// forever — but a browser's ALREADY-INSTALLED service worker only
// re-installs (and purges its old cache) when sw.js's own file bytes
// change. Every ordinary code fix leaves sw.js byte-identical, so any
// browser that visited before that fix shipped keeps silently serving
// its old cached bundle no matter how many times the app itself gets
// redeployed — this is exactly what caused the GlobalDoubtDock fix to
// reach some students/browsers and not others.
//
// Stamping a fresh, unique VERSION into sw.js on every single build
// guarantees the file's bytes always change, so every deploy forces
// every previously-installed service worker to update and drop its old
// cache — this class of bug can't recur just because someone forgot to
// bump a version string by hand.
const fs = require("fs");
const path = require("path");

const swPath = path.join(__dirname, "..", "public", "sw.js");
const version = `v${Date.now()}`;
const contents = fs.readFileSync(swPath, "utf8");
const updated = contents.replace(/const VERSION = "[^"]*";/, `const VERSION = "${version}";`);

if (updated === contents) {
  console.error(`[stamp-sw-version] Could not find a VERSION line to replace in ${swPath} — sw.js may have been restructured; update this script to match.`);
  process.exit(1);
}

fs.writeFileSync(swPath, updated);
console.log(`[stamp-sw-version] public/sw.js VERSION set to ${version}`);
