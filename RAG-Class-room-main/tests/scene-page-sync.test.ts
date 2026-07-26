/**
 * Tests for lib/scene-page-sync.ts's findSceneIndexForPage() — the fix
 * for "PDF page changes on thumbnail click, but AI notes and whiteboard
 * stay on whatever scene was last active." Confirms the matching logic
 * that keeps all three panes on the same page number.
 *
 * Run with: npx tsx --test tests/scene-page-sync.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findSceneIndexForPage } from "../lib/scene-page-sync";

const scenes = [
  { sourcePage: 5 },
  { sourcePage: 6 },
  { sourcePage: 8 },
  { sourcePage: 8 }, // two scenes can share a page (e.g. explain + solve)
  { sourcePage: 12 },
];

test("finds the exact matching scene for a page", () => {
  assert.equal(findSceneIndexForPage(scenes, 6), 1);
});

test("when multiple scenes share a page, returns the FIRST one — so navigation always lands somewhere consistent, not the last one arbitrarily", () => {
  assert.equal(findSceneIndexForPage(scenes, 8), 2);
});

test("falls back to the closest PRECEDING scene when the exact page has no scene of its own", () => {
  assert.equal(findSceneIndexForPage(scenes, 7), 1);
  assert.equal(findSceneIndexForPage(scenes, 10), 2);
});

test("a page before the first scene's page returns -1 — nothing earlier to fall back to", () => {
  assert.equal(findSceneIndexForPage(scenes, 1), -1);
});

test("a page after the last scene's page still returns the last scene (closest preceding)", () => {
  assert.equal(findSceneIndexForPage(scenes, 50), 4);
});

test("returns -1 when there is no lesson loaded at all (empty or missing scenes)", () => {
  assert.equal(findSceneIndexForPage([], 5), -1);
  assert.equal(findSceneIndexForPage(undefined, 5), -1);
  assert.equal(findSceneIndexForPage(null, 5), -1);
});

test("scenes with a missing/invalid sourcePage are safely ignored, not matched by accident", () => {
  const messy = [{ sourcePage: undefined }, { sourcePage: NaN as any }, { sourcePage: 4 }];
  assert.equal(findSceneIndexForPage(messy, 4), 2);
  assert.equal(findSceneIndexForPage(messy, 1), -1);
});

test("scenes out of page order are still matched correctly (exact match doesn't assume sorted input)", () => {
  const outOfOrder = [{ sourcePage: 9 }, { sourcePage: 3 }, { sourcePage: 6 }];
  assert.equal(findSceneIndexForPage(outOfOrder, 3), 1);
  assert.equal(findSceneIndexForPage(outOfOrder, 9), 0);
});
