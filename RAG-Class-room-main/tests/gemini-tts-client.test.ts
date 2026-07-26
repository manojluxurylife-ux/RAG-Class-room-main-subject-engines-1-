/**
 * Tests for lib/student-key.ts's callGeminiTtsClient() — confirms the
 * actual request sent to Gemini's TTS endpoint has the right shape
 * (model, responseModalities, voice) and that a successful response is
 * correctly unwrapped, without needing a real API key.
 *
 * Run with: npx tsx --test tests/gemini-tts-client.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

if (typeof (globalThis as any).window === "undefined") {
  const store = new Map<string, string>();
  (globalThis as any).window = {
    setTimeout: (...args: any[]) => setTimeout(...(args as [any, any])),
    clearTimeout: (...args: any[]) => clearTimeout(...(args as [any])),
    dispatchEvent: () => {},
  };
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
}

const originalFetch = global.fetch;
const FAKE_KEY = "AIza" + "x".repeat(35);

function mockFetch(captured: { url?: string; body?: any }) {
  global.fetch = (async (url: string, init: any) => {
    captured.url = url;
    captured.body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { data: "ZmFrZS1wY20tYnl0ZXM=", mimeType: "audio/L16;rate=24000" } }] } }],
      }),
    };
  }) as any;
}

test("sends the correct model, responseModalities, and voice name", async () => {
  const { studentKey, callGeminiTtsClient } = await import("../lib/student-key");
  studentKey.save(FAKE_KEY);
  const captured: { url?: string; body?: any } = {};
  mockFetch(captured);
  try {
    await callGeminiTtsClient("Plants make food using sunlight.", "ml-IN");
    assert.ok(captured.url!.includes("gemini-3.1-flash-tts-preview"), "must use the current documented TTS model");
    assert.deepEqual(captured.body.generationConfig.responseModalities, ["AUDIO"]);
    assert.equal(captured.body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Kore");
  } finally {
    global.fetch = originalFetch;
  }
});

test("correctly unwraps the returned base64 audio data and mimeType", async () => {
  const { studentKey, callGeminiTtsClient } = await import("../lib/student-key");
  studentKey.save(FAKE_KEY);
  mockFetch({});
  try {
    const result = await callGeminiTtsClient("Hello.", "en-IN");
    assert.equal(result.data, "ZmFrZS1wY20tYnl0ZXM=");
    assert.equal(result.mimeType, "audio/L16;rate=24000");
  } finally {
    global.fetch = originalFetch;
  }
});

test("throws a clear error when Gemini's response has no audio part", async () => {
  const { studentKey, callGeminiTtsClient } = await import("../lib/student-key");
  studentKey.save(FAKE_KEY);
  global.fetch = (async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: "no audio here" }] } }] }),
  })) as any;
  try {
    await assert.rejects(() => callGeminiTtsClient("Hello.", "en-IN"), /did not return.*audio/i);
  } finally {
    global.fetch = originalFetch;
  }
});
