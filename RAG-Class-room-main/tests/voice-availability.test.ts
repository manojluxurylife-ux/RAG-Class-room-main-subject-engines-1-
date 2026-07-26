/**
 * Tests for lib/web-speech.ts's hasVoiceFor() — the upfront voice-
 * availability check added to fix the "Malayalam is not speaking /
 * whiteboard is not using" report. See the comments in narrate() and
 * startClass() in app/(student)/rag-classroom/page.tsx for the full
 * mechanism this addresses: a missing voice used to make narrate()
 * finish in under a millisecond, giving the whiteboard no real time to
 * animate and skipping the actual teaching content almost instantly.
 *
 * Run with: npx tsx --test tests/voice-availability.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

function fakeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, default: false, localService: true, voiceURI: name } as any;
}

function installFakeSpeechSynthesis(voices: SpeechSynthesisVoice[]) {
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.speechSynthesis = {
    getVoices: () => voices,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  (globalThis as any).speechSynthesis = (globalThis as any).window.speechSynthesis;
}

test("hasVoiceFor() returns true when a matching-language voice exists", async () => {
  installFakeSpeechSynthesis([fakeVoice("Google हिन्दी", "hi-IN"), fakeVoice("Google മലയാളം", "ml-IN")]);
  const { hasVoiceFor, __resetVoiceCacheForTests } = await import("../lib/web-speech");
  __resetVoiceCacheForTests();
  assert.equal(await hasVoiceFor("malayalam"), true);
});

test("hasVoiceFor() returns false when the device has no voice for that language at all (the real-world common case on budget Android)", async () => {
  installFakeSpeechSynthesis([fakeVoice("Google US English", "en-US"), fakeVoice("Google हिन्दी", "hi-IN")]);
  const { hasVoiceFor, __resetVoiceCacheForTests } = await import("../lib/web-speech");
  __resetVoiceCacheForTests();
  assert.equal(await hasVoiceFor("malayalam"), false);
});

test("hasVoiceFor() accepts an ungendered voice as a fallback, not just explicitly-female-labeled ones", async () => {
  // Many Android system voices have no gender marker in their name at
  // all — selectFemaleVoice()'s existing fallback (first non-male-
  // labeled match) must still be honored here, not require an explicit
  // "female" hint.
  installFakeSpeechSynthesis([fakeVoice("ml-IN-language-1", "ml-IN")]);
  const { hasVoiceFor, __resetVoiceCacheForTests } = await import("../lib/web-speech");
  __resetVoiceCacheForTests();
  assert.equal(await hasVoiceFor("malayalam"), true);
});

test("hasVoiceFor() returns false for a language with only an explicitly-male voice available", async () => {
  installFakeSpeechSynthesis([fakeVoice("Malayalam Male Voice", "ml-IN")]);
  const { hasVoiceFor, __resetVoiceCacheForTests } = await import("../lib/web-speech");
  __resetVoiceCacheForTests();
  assert.equal(await hasVoiceFor("malayalam"), false);
});

test("minDisplayDurationMs() gives short text a sensible floor, not a near-zero skip", async () => {
  const { minDisplayDurationMs } = await import("../lib/web-speech");
  assert.equal(minDisplayDurationMs(5, 1), 4000, "even a tiny text must not finish near-instantly");
});

test("minDisplayDurationMs() scales up for longer text and caps at a sane ceiling", async () => {
  const { minDisplayDurationMs } = await import("../lib/web-speech");
  assert.ok(minDisplayDurationMs(500, 1) > minDisplayDurationMs(50, 1), "longer text should get more display time");
  assert.equal(minDisplayDurationMs(100000, 1), 60000, "must not hang the class forever on a very long scene");
});

test("minDisplayDurationMs() respects teaching speed without dropping below the floor at extreme settings", async () => {
  const { minDisplayDurationMs } = await import("../lib/web-speech");
  assert.ok(minDisplayDurationMs(300, 1.2) < minDisplayDurationMs(300, 0.6), "faster teaching speed should shorten the wait");
  assert.ok(minDisplayDurationMs(10, 5) >= 4000, "an extreme speed setting must not defeat the minimum floor");
});
