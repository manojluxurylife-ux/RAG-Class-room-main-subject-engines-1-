/**
 * Offline / on-device AI — VibeThinker-3B via wllama (llama.cpp
 * compiled to WASM), same runtime as lib/offline-ai.ts's Qwen3.5-0.8B
 * model, but kept as a fully separate/independent module rather than
 * folded into that one.
 *
 * WHY THIS EXISTS: added specifically as a second, alternative on-device
 * option after Google started blocking some students' free Gemini API
 * keys — the BYOK model this app leans on for cost reasons is only as
 * reliable as Google's own willingness to keep issuing free keys, and
 * this is a hedge against that.
 *
 * MODEL: manojbillionaire123/VibeThinker-3B-Q4_K_M-GGUF,
 *   vibethinker-3b-q4_k_m.gguf (1.93 GB, verified live against the
 *   repo's actual file listing — not assumed). 3B params, Qwen2.5-3B
 *   base, WeiboAI's math/code/reasoning finetune, MIT licence.
 *
 * HONEST SIZE WARNING, discussed directly with the project owner before
 * building this: this is ~3.5x the size of the existing Qwen3.5-0.8B
 * offline model (1.93 GB vs 550 MB), on an app whose stated target
 * hardware is 3–4 GB RAM budget Android phones. The owner's explicit
 * call: ship it anyway and accept some students' devices won't be able
 * to load it — not this file's decision to second-guess. The retry-
 * with-CPU-fallback logic below (same fix applied to offline-ai.ts
 * after a real "download reaches 100% then fails" bug report) matters
 * even more here, since a bigger model makes that failure mode more
 * likely, not less.
 *
 * ROLE / INTEGRATION: intentionally NOT wired into any generation flow
 * yet — the owner wasn't sure yet where this should actually run
 * (in-browser on student devices vs. somewhere server-side) when this
 * was built. This module only makes it downloadable and available
 * (see the Settings page's "Reasoning Brain" section); wiring it into
 * study-material generation is a separate follow-up once that's
 * decided, not assumed here.
 *
 * NOT multimodal — unlike Qwen3.5, VibeThinker-3B has no vision/mmproj
 * variant on the source repo, so there's no vision counterpart here
 * (contrast with getVisionStatus/downloadVision in lib/offline-ai.ts).
 */

import { Wllama, type AssetsPathConfig } from "@wllama/wllama/esm/index.js";
import type {
  ChatCompletionMessage,
  ChatCompletionResponse,
} from "@wllama/wllama/esm/types/oai-compat";

export type OfflineStatus = "not-downloaded" | "downloading" | "ready" | "error";

const STATUS_KEY = "gg_offline_vibethinker_status";
const MODEL_ID_KEY = "gg_offline_vibethinker_id";
// Verified live against the repo's actual file listing
// (huggingface.co/manojbillionaire123/VibeThinker-3B-Q4_K_M-GGUF) —
// Q4_K_M, 1.93 GB, filename confirmed from the repo's own llama.cpp
// usage instructions.
const HF_REPO  = "manojbillionaire123/VibeThinker-3B-Q4_K_M-GGUF";
const HF_FILE  = "vibethinker-3b-q4_k_m.gguf";
const MODEL_ID = `${HF_REPO}/${HF_FILE}`;

// Same CDN-hosted wllama WASM binaries as lib/offline-ai.ts — this is
// the runtime, not the model, so there's no reason for it to differ.
const CONFIG_PATHS: AssetsPathConfig = {
  default: "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/single-thread/wllama.wasm",
  "single-thread/wllama.wasm": "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/single-thread/wllama.wasm",
  "multi-thread/wllama.wasm":  "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/multi-thread/wllama.wasm",
};

// Singleton, independent from offline-ai.ts's own Qwen singleton — a
// student could in principle have both models resident, though on the
// target 3–4GB RAM hardware that's realistically not going to work,
// which is exactly the size trade-off documented above.
let wllamaInstance: Wllama | null = null;
let loadPromise: Promise<Wllama> | null = null;

export const offlineVibeThinker = {
  getStatus(): OfflineStatus {
    if (typeof window === "undefined") return "not-downloaded";
    const savedModel = localStorage.getItem(MODEL_ID_KEY);
    const savedStatus = (localStorage.getItem(STATUS_KEY) as OfflineStatus) || "not-downloaded";
    if (savedStatus === "downloading" && !loadPromise) {
      localStorage.setItem(STATUS_KEY, "not-downloaded");
      return "not-downloaded";
    }
    if (savedStatus === "ready" && savedModel !== MODEL_ID) return "not-downloaded";
    return savedStatus;
  },

  /**
   * Downloads and initializes the model. Safe to call multiple times —
   * subsequent calls reuse the in-flight or completed load. Same
   * download-completed-but-load-failed retry logic as
   * lib/offline-ai.ts's download() — see that file's comments for the
   * full "why" (a real bug report: download reaches 100%, then fails,
   * because loading a model into memory/GPU afterward is a separate
   * step that can fail on its own, usually from low RAM).
   */
  async download(onProgress?: (pct: number) => void): Promise<void> {
    if (wllamaInstance) { onProgress?.(100); return; }
    if (loadPromise)    { await loadPromise; onProgress?.(100); return; }

    localStorage.setItem(STATUS_KEY, "downloading");

    let downloadFinished = false;

    const attemptLoad = async (nGpuLayers: number) => {
      const wllama = new Wllama(CONFIG_PATHS, {
        parallelDownloads: 6,
        allowOffline: true,
      });
      await wllama.loadModelFromHF(
        { repo: HF_REPO, file: HF_FILE },
        {
          progressCallback: ({ loaded, total }) => {
            if (total > 0) {
              const pct = Math.round((loaded / total) * 100);
              if (pct >= 100) downloadFinished = true;
              onProgress?.(pct);
            }
          },
          // Kept modest for the same RAM reasons as offline-ai.ts,
          // even more relevant given this model is already ~3.5x
          // larger — a big context window is a liability here, not a
          // feature, on 3–4GB RAM phones.
          n_ctx: 4096,
          n_gpu_layers: nGpuLayers,
        },
      );
      return wllama;
    };

    loadPromise = (async () => {
      try {
        return await attemptLoad(99999); // wllama's own default — WebGPU if available
      } catch (firstError) {
        if (!downloadFinished) throw firstError; // genuine download/network failure
        console.error("[offline-ai-vibethinker] GPU-accelerated load failed after a successful download, retrying CPU-only:", firstError);
        try {
          return await attemptLoad(0);
        } catch (secondError: any) {
          const err = new Error(
            "The model file downloaded completely, but your device couldn't load it into memory afterward " +
            "(this usually means it's low on free RAM — VibeThinker-3B is a much bigger model, 1.93GB, so this " +
            "is more likely to happen than with the smaller Qwen3.5 offline model). Try closing other apps/browser tabs, then try again."
          );
          (err as any).cause = secondError;
          throw err;
        }
      }
    })();

    try {
      wllamaInstance = await loadPromise;
      localStorage.setItem(STATUS_KEY, "ready");
      localStorage.setItem(MODEL_ID_KEY, MODEL_ID);
    } catch (e) {
      localStorage.setItem(STATUS_KEY, "error");
      loadPromise = null;
      throw e;
    }
  },

  /**
   * Generates a response for the given system + user prompt. Throws if
   * the model hasn't been downloaded yet — callers should check
   * getStatus() === "ready" first.
   */
  async generate(system: string, userContent: string): Promise<string> {
    if (!wllamaInstance) {
      if (offlineVibeThinker.getStatus() === "ready") {
        await offlineVibeThinker.download();
      } else {
        throw new Error("VibeThinker-3B not downloaded yet. Go to Settings to download it first.");
      }
    }

    const messages: ChatCompletionMessage[] = [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ];

    const result = (await wllamaInstance!.createChatCompletion({
      messages,
      // Reasoning models generate a long "thinking" trace before their
      // final answer — WeiboAI's own benchmark setup uses no cap
      // beyond the model's max (up to 40,960 tokens for hard
      // problems), which is not remotely practical on this app's
      // target hardware/latency budget. 1600 is a compromise, NOT an
      // empirically tested number — genuinely possible this cuts off
      // reasoning before it reaches a final answer on harder
      // questions. Worth watching once this is actually used, and
      // raising if truncated/incomplete answers show up in practice.
      max_tokens: 1600,
      // WeiboAI's own documented recommended sampling (verified
      // directly against WeiboAI/VibeThinker's GitHub README, not
      // guessed): temperature 0.6 or 1.0, top_p 0.95, top_k disabled
      // (-1). Using 0.6 here (their lower/more deterministic option) —
      // study-material generation benefits more from consistency than
      // the extra solution diversity 1.0 is meant for during
      // benchmark sampling.
      temperature: 0.6,
      top_p: 0.95,
      top_k: -1,
    } as any)) as ChatCompletionResponse;

    return result?.choices?.[0]?.message?.content ?? "";
  },

  /** Frees the loaded model from memory. */
  async unload(): Promise<void> {
    if (wllamaInstance) {
      await wllamaInstance.exit();
      wllamaInstance = null;
      loadPromise = null;
    }
  },

  clear() {
    localStorage.removeItem(STATUS_KEY);
    localStorage.removeItem(MODEL_ID_KEY);
    offlineVibeThinker.unload();
  },

  modelInfo: {
    repo: HF_REPO,
    file: HF_FILE,
    approxSizeGB: 1.93,
  },
};
