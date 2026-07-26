/**
 * Tests for lib/offline-ai.ts's getVisionStatus() — the status-tracking
 * logic behind offline camera support. The actual model download/load
 * (downloadVision, generateWithImage) needs a real browser with WASM
 * and network access and isn't exercised here; this covers the pure
 * localStorage-based status derivation, which mirrors getStatus()'s
 * already-established pattern for the text-only model.
 *
 * Run with: npx tsx --test tests/offline-vision-status.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

if (typeof (globalThis as any).window === "undefined") {
  const store = new Map<string, string>();
  (globalThis as any).window = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
}

test("getVisionStatus() returns 'not-downloaded' when nothing has been saved", async () => {
  localStorage.removeItem("gg_offline_vision_model_status");
  localStorage.removeItem("gg_offline_vision_model_id");
  const { offlineAI } = await import("../lib/offline-ai");
  assert.equal(offlineAI.getVisionStatus(), "not-downloaded");
});

test("getVisionStatus() no longer hardcodes 'unsupported' — the real gap this delivery fixes", async () => {
  const { offlineAI } = await import("../lib/offline-ai");
  assert.notEqual(offlineAI.getVisionStatus(), "unsupported");
});

test("getVisionStatus() returns 'ready' only when the saved model ID matches the CURRENT configured vision model", async () => {
  const { offlineAI } = await import("../lib/offline-ai");
  localStorage.setItem("gg_offline_vision_model_status", "ready");
  localStorage.setItem("gg_offline_vision_model_id", "manojbillionaire123/Qwen3.5-0.8B-MTP-GGUF/Qwen3.5-0.8B-Q4_K_M.gguf+mmproj-F16.gguf");
  assert.equal(offlineAI.getVisionStatus(), "ready");
});

test("getVisionStatus() resets to 'not-downloaded' if the saved model ID is stale (e.g. from a previous mmproj file choice)", async () => {
  const { offlineAI } = await import("../lib/offline-ai");
  localStorage.setItem("gg_offline_vision_model_status", "ready");
  localStorage.setItem("gg_offline_vision_model_id", "some-old-repo/some-old-mmproj.gguf");
  assert.equal(offlineAI.getVisionStatus(), "not-downloaded");
});

test("getVisionStatus() resets a stuck 'downloading' status back to 'not-downloaded' (e.g. after a page reload mid-download)", async () => {
  const { offlineAI } = await import("../lib/offline-ai");
  localStorage.setItem("gg_offline_vision_model_status", "downloading");
  assert.equal(offlineAI.getVisionStatus(), "not-downloaded");
});

test("visionModelInfo reports the real, verified mmproj file and size, not a stale placeholder", async () => {
  const { offlineAI } = await import("../lib/offline-ai");
  assert.equal(offlineAI.visionModelInfo.file, "mmproj-F16.gguf");
  assert.equal(offlineAI.visionModelInfo.repo, "manojbillionaire123/Qwen3.5-0.8B-MTP-GGUF");
  assert.ok(offlineAI.visionModelInfo.approxExtraSizeGB < 0.3, "should reflect the real ~205MB size, not the old ~0.9GB placeholder");
});
