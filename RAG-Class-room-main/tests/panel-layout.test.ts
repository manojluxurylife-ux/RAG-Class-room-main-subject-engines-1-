/**
 * Tests for lib/client/panel-layout.ts — the pure positioning math
 * behind RAG Classroom's draggable floating panels.
 *
 * Run with: npx tsx --test tests/panel-layout.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultPanelLayout, clampRectToCanvas, bringToFront,
  MIN_PANEL_W, MIN_PANEL_H, type PanelLayout,
} from "../lib/client/panel-layout";

test("defaultPanelLayout produces three non-overlapping panels filling the canvas", () => {
  const layout = defaultPanelLayout({ w: 1200, h: 700 });
  const ids = Object.keys(layout);
  assert.deepEqual(ids.sort(), ["notes", "textbook", "whiteboard"]);
  assert.ok(layout.textbook.x < layout.notes.x);
  assert.ok(layout.notes.x < layout.whiteboard.x);
  assert.ok(layout.textbook.x + layout.textbook.w <= layout.notes.x);
});

test("defaultPanelLayout never produces a panel smaller than the minimum size, even on a tiny canvas", () => {
  const layout = defaultPanelLayout({ w: 300, h: 150 });
  for (const rect of Object.values(layout)) {
    assert.ok(rect.w >= MIN_PANEL_W);
    assert.ok(rect.h >= MIN_PANEL_H);
  }
});

test("clampRectToCanvas keeps a reasonably-placed panel unchanged", () => {
  const rect = { x: 100, y: 100, w: 400, h: 300, z: 1 };
  const clamped = clampRectToCanvas(rect, { w: 1200, h: 800 });
  assert.equal(clamped.x, 100);
  assert.equal(clamped.y, 100);
  assert.equal(clamped.w, 400);
  assert.equal(clamped.h, 300);
});

test("clampRectToCanvas never lets a panel be dragged fully off-screen — some part always stays reachable", () => {
  const rect = { x: -10000, y: -10000, w: 400, h: 300, z: 1 };
  const clamped = clampRectToCanvas(rect, { w: 1200, h: 800 });
  assert.ok(clamped.x + clamped.w > 0);
  assert.ok(clamped.y >= 0, "must never go above the visible top — the title bar needs to stay reachable to drag back");
});

test("clampRectToCanvas never lets a panel be dragged far past the opposite edge either", () => {
  const rect = { x: 100000, y: 100000, w: 400, h: 300, z: 1 };
  const clamped = clampRectToCanvas(rect, { w: 1200, h: 800 });
  assert.ok(clamped.x < 1200);
  assert.ok(clamped.y < 800);
});

test("clampRectToCanvas enforces the minimum panel size even if a resize tried to go smaller", () => {
  const rect = { x: 0, y: 0, w: 10, h: 10, z: 1 };
  const clamped = clampRectToCanvas(rect, { w: 1200, h: 800 });
  assert.equal(clamped.w, MIN_PANEL_W);
  assert.equal(clamped.h, MIN_PANEL_H);
});

test("clampRectToCanvas never lets a panel be resized larger than the canvas itself", () => {
  const rect = { x: 0, y: 0, w: 5000, h: 5000, z: 1 };
  const clamped = clampRectToCanvas(rect, { w: 1200, h: 800 });
  assert.ok(clamped.w <= 1200);
  assert.ok(clamped.h <= 800);
});

test("bringToFront raises the target panel's z above every other panel", () => {
  const layout: PanelLayout = {
    a: { x: 0, y: 0, w: 300, h: 300, z: 3 },
    b: { x: 0, y: 0, w: 300, h: 300, z: 1 },
    c: { x: 0, y: 0, w: 300, h: 300, z: 2 },
  };
  const next = bringToFront(layout, "b");
  assert.ok(next.b.z > next.a.z);
  assert.ok(next.b.z > next.c.z);
});

test("bringToFront leaves the layout unchanged (same object, no unnecessary re-render) if the panel is already uniquely on top", () => {
  const layout: PanelLayout = {
    a: { x: 0, y: 0, w: 300, h: 300, z: 1 },
    b: { x: 0, y: 0, w: 300, h: 300, z: 2 },
  };
  const next = bringToFront(layout, "b");
  assert.equal(next, layout, "should return the exact same reference when nothing needs to change");
});

test("bringToFront on an unknown panel id is a safe no-op", () => {
  const layout: PanelLayout = { a: { x: 0, y: 0, w: 300, h: 300, z: 1 } };
  const next = bringToFront(layout, "does-not-exist");
  assert.equal(next, layout);
});
