/**
 * Tests for lib/client/text-spotlight.ts — the matching logic behind
 * TextbookPageView's "torch beam" spotlight, which now runs once per
 * paragraph (fed by the classroom's activeUnitIndex) instead of once
 * per scene, making it worth real test coverage.
 *
 * Run with: npx tsx --test tests/text-spotlight.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, findPhraseMatch, boxesToPercentBounds, type TextItemBox } from "../lib/client/text-spotlight";

function box(str: string, x: number, y: number, w: number, h: number): TextItemBox {
  return { str, x, y, w, h };
}

test("normalize lowercases and collapses punctuation/whitespace", () => {
  assert.equal(normalize("  Hello,   World!!  "), "hello world");
});

test("normalize handles Malayalam script without throwing, and is consistent — the same text always normalizes the same way, which is what matching actually depends on", () => {
  const text = "പേനയും 5 നോട്ട്ബുക്കും";
  const a = normalize(text);
  const b = normalize(text);
  assert.equal(a, b);
  assert.ok(a.includes("5"));
  // Honest note: the letter-only regex strips Malayalam's combining
  // vowel signs (a Unicode "Mark", not a "Letter"), so the normalized
  // form isn't fully readable Malayalam — but since both the page's
  // text and the search phrase go through this same function, matching
  // itself still works correctly. Not something this extraction
  // changes; documented here since it was worth discovering.
});

test("findPhraseMatch finds a phrase spanning multiple consecutive text items", () => {
  const items = [box("There", 0, 0, 40, 10), box("are", 45, 0, 25, 10), box("100", 75, 0, 30, 10), box("beads.", 110, 0, 45, 10)];
  const matched = findPhraseMatch(items, "There are 100 beads");
  assert.ok(matched);
  assert.equal(matched!.length, 4);
});

test("findPhraseMatch finds the phrase starting partway through the page's items", () => {
  const items = [box("Chapter", 0, 0, 50, 10), box("7:", 55, 0, 15, 10), box("Pairs", 75, 0, 40, 10), box("of", 120, 0, 20, 10), box("Equations", 145, 0, 60, 10)];
  const matched = findPhraseMatch(items, "Pairs of Equations");
  assert.ok(matched);
  assert.deepEqual(matched!.map(b => b.str), ["Pairs", "of", "Equations"]);
});

test("findPhraseMatch returns null when the phrase genuinely isn't on the page — a shrug, not a guess", () => {
  const items = [box("Something", 0, 0, 50, 10), box("else", 55, 0, 30, 10), box("entirely.", 90, 0, 50, 10)];
  assert.equal(findPhraseMatch(items, "There are 100 beads"), null);
});

test("findPhraseMatch returns null for an empty page (scanned PDF, no text layer)", () => {
  assert.equal(findPhraseMatch([], "any phrase at all"), null);
});

test("findPhraseMatch returns null for a phrase too short to be meaningful (avoids matching on a stray word)", () => {
  const items = [box("The cat sat", 0, 0, 60, 10)];
  assert.equal(findPhraseMatch(items, "at"), null);
});

test("findPhraseMatch tolerates punctuation/case differences between the source and the matched page text", () => {
  const items = [box("THERE", 0, 0, 40, 10), box("are,", 45, 0, 30, 10), box("100", 80, 0, 30, 10), box("beads", 115, 0, 40, 10)];
  const matched = findPhraseMatch(items, "there are 100 beads");
  assert.ok(matched);
});

test("boxesToPercentBounds computes a padded percentage bounding box around matched items", () => {
  const matched = [box("Pairs", 100, 50, 40, 10), box("of", 145, 50, 20, 10), box("Equations", 170, 50, 60, 10)];
  const pct = boxesToPercentBounds(matched, { w: 1000, h: 1000 }, 6);
  assert.equal(pct.left, (100 - 6) / 1000 * 100);
  assert.equal(pct.top, (50 - 6) / 1000 * 100);
  assert.ok(pct.width > 0 && pct.height > 0);
});

test("boxesToPercentBounds never produces a negative left/top even with padding near the page edge", () => {
  const matched = [box("Edge", 1, 1, 20, 10)];
  const pct = boxesToPercentBounds(matched, { w: 500, h: 500 }, 6);
  assert.ok(pct.left >= 0);
  assert.ok(pct.top >= 0);
});

test("boxesToPercentBounds never exceeds 100% width/height even for a match spanning the whole page", () => {
  const matched = [box("Whole page", 0, 0, 1000, 1000)];
  const pct = boxesToPercentBounds(matched, { w: 1000, h: 1000 }, 6);
  assert.ok(pct.width <= 100);
  assert.ok(pct.height <= 100);
});
