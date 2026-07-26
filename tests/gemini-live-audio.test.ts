/**
 * Tests for lib/gemini-live.ts's encodeBytes/decodeBytes — pre-existing
 * helpers built for the Live API doubt-clearing feature, now also
 * relied on by the RAG Classroom's Gemini-voice narration (decoding the
 * base64 PCM audio callGeminiTtsClient returns). Not previously tested;
 * covering the round-trip since correctness here is now load-bearing
 * for a second feature. decodeAudioData itself needs a real
 * AudioContext and isn't testable outside a browser — verified via
 * tsc + build + manual review instead.
 *
 * Run with: npx tsx --test tests/gemini-live-audio.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeBytes, decodeBytes } from "../lib/gemini-live";

test("decodeBytes(encodeBytes(x)) round-trips exactly", () => {
  const original = new Uint8Array([0, 1, 2, 255, 128, 64, 10, 200]);
  const roundTripped = decodeBytes(encodeBytes(original));
  assert.deepEqual(Array.from(roundTripped), Array.from(original));
});

test("handles an empty byte array", () => {
  const roundTripped = decodeBytes(encodeBytes(new Uint8Array([])));
  assert.equal(roundTripped.length, 0);
});

test("handles a realistic PCM-sized buffer without corruption", () => {
  // Simulate ~1 second of 16-bit mono PCM at 24kHz (48000 bytes).
  const original = new Uint8Array(48000);
  for (let i = 0; i < original.length; i++) original[i] = (i * 37) % 256;
  const roundTripped = decodeBytes(encodeBytes(original));
  assert.equal(roundTripped.length, original.length);
  assert.deepEqual(Array.from(roundTripped), Array.from(original));
});
