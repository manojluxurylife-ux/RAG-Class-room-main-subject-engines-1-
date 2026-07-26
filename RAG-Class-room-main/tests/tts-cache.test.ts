/**
 * Tests for lib/client/tts-cache.ts's hashCacheKey() — the pure,
 * deterministic piece of the TTS audio cache. IndexedDB I/O itself
 * isn't tested here (no browser environment in plain Node, and it's a
 * thin, well-understood wrapper matching the existing pdf-store.ts
 * pattern) — this covers the part that actually has logic worth
 * getting wrong.
 *
 * Run with: npx tsx --test tests/tts-cache.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashCacheKey } from "../lib/client/tts-cache";

test("same text and voice always produce the same key", () => {
  const a = hashCacheKey("Plants make food using sunlight.", "Kore");
  const b = hashCacheKey("Plants make food using sunlight.", "Kore");
  assert.equal(a, b);
});

test("different text produces a different key", () => {
  const a = hashCacheKey("Plants make food using sunlight.", "Kore");
  const b = hashCacheKey("Plants make food using rain.", "Kore");
  assert.notEqual(a, b);
});

test("different voice produces a different key for the same text — a voice change must not replay stale cached audio", () => {
  const a = hashCacheKey("Same paragraph text.", "Kore");
  const b = hashCacheKey("Same paragraph text.", "Puck");
  assert.notEqual(a, b);
});

test("keys are safe IndexedDB key strings (no null bytes, reasonable length)", () => {
  const key = hashCacheKey("Any narration text at all, potentially quite long, with Malayalam മലയാളം mixed in too.", "Kore");
  assert.equal(typeof key, "string");
  assert.ok(key.length > 0 && key.length < 20);
  assert.ok(/^[a-z0-9]+$/.test(key));
});

test("handles empty text without throwing", () => {
  assert.doesNotThrow(() => hashCacheKey("", "Kore"));
});
