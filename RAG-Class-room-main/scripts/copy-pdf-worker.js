/**
 * Copies pdfjs-dist's worker file into /public so it's served as a plain
 * static asset — no CDN dependency (which 404s when cdnjs doesn't mirror
 * the exact installed version), no webpack asset processing (which fails
 * Next.js's production Terser pass on `import.meta` inside the .mjs file).
 * Runs automatically on every `npm install` via the "postinstall" script,
 * so this file always matches whatever pdfjs-dist version is actually
 * installed, even after a version bump. See components/PDFPagePicker.tsx
 * for the full story.
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const dest = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");

try {
  fs.copyFileSync(src, dest);
  console.log("✓ Copied pdf.worker.min.mjs to public/");
} catch (e) {
  console.warn("⚠ Could not copy pdf.worker.min.mjs — PDF upload may not work.", e.message);
  // Don't fail the whole install over this — just warn. A stale copy
  // already in public/ (if any) will still mostly work.
}
