/**
 * Offline / on-device AI — Qwen3.5-0.8B via wllama (llama.cpp compiled to WASM).
 *
 * MODEL: manojbillionaire123/Qwen3.5-0.8B-MTP-GGUF, Qwen3.5-0.8B-Q4_K_M.gguf
 *   (~550 MB). Hosted on the project owner's own HuggingFace account —
 *   verified live (fetched the repo's actual file listing, not assumed)
 *   before pointing this at it: the exact filename below is genuinely
 *   served at /resolve/main and downloads a real GGUF, not a 404.
 *   0.8B params, 262K native context (kept far smaller here — see n_ctx
 *   below — lessons/Q&A don't need anywhere near that, and a huge
 *   context window on a 3GB-RAM phone is a liability, not a feature),
 *   natively multilingual (201 languages/dialects including Malayalam),
 *   Apache 2.0 licence.
 *
 * ROLE IN THE APP: FALLBACK, not primary.
 *   Gemini (server key or student BYOK) is the default — it's faster, higher
 *   quality, and needs no download. This offline model only activates when:
 *     (a) the primary Gemini call fails (e.g. no internet), AND
 *     (b) the student already downloaded this model while they had Wi-Fi.
 *   See app/(student)/classroom/page.tsx for the automatic fallback logic.
 *
 * WHY THIS MODEL, NOT A LARGER ONE:
 *   Earlier versions of this file pointed at Gemma 4 E2B (~3.1 GB) and then,
 *   as a stopgap when the owner's Qwen repo briefly didn't serve a GGUF
 *   file, at a substitute MiniCPM-3B model (~2 GB) from an unrelated
 *   HuggingFace account. Both are gone now — the owner's own Qwen3.5-0.8B
 *   repo genuinely hosts working GGUF files today, and at 550 MB it's a
 *   dramatically better fit for the 3GB-RAM budget Android phones this app
 *   targets than either predecessor was.
 *
 * BROWSER SUPPORT:
 *   WebGPU (Chrome on decent Android/desktop) — fast enough to feel usable.
 *   WASM CPU fallback (older phones, Safari, Firefox without WebGPU) — slower
 *   but functional for short answers, and a real 0.8B model is far more
 *   forgiving on CPU than the multi-GB models this used to point at.
 *   wllama auto-detects and picks the best available backend.
 */

import { Wllama, ModelManager, getHFModelSource, type AssetsPathConfig } from "@wllama/wllama/esm/index.js";
import type {
  ChatCompletionMessage,
  ChatCompletionMessageContent,
  ChatCompletionResponse,
} from "@wllama/wllama/esm/types/oai-compat";

export type OfflineStatus = "not-downloaded" | "downloading" | "ready" | "error";

const STATUS_KEY = "gg_offline_model_status";
const MODEL_ID_KEY = "gg_offline_model_id";
// Brain2 — the on-device model. Verified live against the repo's actual
// file listing (huggingface.co/manojbillionaire123/Qwen3.5-0.8B-MTP-GGUF
// /tree/main) before pointing this here — Q4_K_M is a well-regarded
// balance of size and quality among GGUF k-quants, and matches the same
// quant level this file has always used for its on-device model choice.
const HF_REPO    = "manojbillionaire123/Qwen3.5-0.8B-MTP-GGUF";
const HF_FILE    = "Qwen3.5-0.8B-Q4_K_M.gguf";
const MODEL_ID   = `${HF_REPO}/${HF_FILE}`;
// The vision adapter (mmproj) for THIS SAME model — Qwen3.5 is natively
// multimodal, and its own repo hosts the matching mmproj file, so
// vision reuses HF_REPO/HF_FILE above rather than pointing at a
// separate model entirely. Also verified live against the repo's real
// file listing (same /tree/main fetch that confirmed HF_FILE above) —
// mmproj-F16.gguf genuinely exists there at 205 MB, the smallest of
// the three mmproj quantizations offered (F16/BF16/F32), a sensible
// choice for the budget Android phones this app targets.
const HF_MMPROJ_FILE = "mmproj-F16.gguf";

// ── Vision (camera) support — separate download, separate status ──────────
// Confirmed directly against the real wllama 3.5.1 type definitions
// (installed and inspected, not guessed from docs): wllama loads a
// multimodal model via ModelManager.downloadModel({url, mmprojUrl}) —
// a single call that fetches BOTH the main GGUF and its mmproj
// together, with combined progress tracking and caching — then
// model.open() returns both as Blobs for Wllama.loadModel(blobs, ...).
// getHFModelSource({repo, file, mmprojFile}) builds the ModelSource
// from a HuggingFace repo/file pair, so no URL is hand-constructed.
// After loading, wllama.supportInputModality('image') is checked for
// real before trusting the combination actually works — a status of
// "ready" here means it was verified at load time, not just assumed
// from config.
//
// Kept as a SEPARATE download/status from the text-only model above —
// Classroom's existing text lesson fallback doesn't need vision at all,
// and the mmproj file is a real, substantial extra download that
// shouldn't be forced on every offline user. Whether this reuses the
// text-only download's already-cached main-model bytes (both configs
// point at the same file) depends on wllama's own cache-sharing
// behavior across separate ModelManager instances — genuinely not
// verified either way, so this is NOT promised as a guaranteed instant
// second download; if the student hasn't downloaded the text model
// first, this downloads the full ~550MB + the ~205MB mmproj together.
export type OfflineVisionStatus = "not-downloaded" | "downloading" | "ready" | "error" | "unsupported";
const VISION_STATUS_KEY = "gg_offline_vision_model_status";
const VISION_MODEL_ID_KEY = "gg_offline_vision_model_id";
const VISION_MODEL_ID = `${HF_REPO}/${HF_FILE}+${HF_MMPROJ_FILE}`;

let visionWllamaInstance: Wllama | null = null;
let visionLoadPromise: Promise<Wllama> | null = null;

// wllama's WASM binaries, served from jsDelivr so no files need to be copied
// into /public. `default` is required by AssetsPathConfig as the fallback
// path; the thread-specific keys let wllama pick single vs multi-thread
// automatically based on the browser's SharedArrayBuffer support.
const CONFIG_PATHS: AssetsPathConfig = {
  default: "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/single-thread/wllama.wasm",
  "single-thread/wllama.wasm": "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/single-thread/wllama.wasm",
  "multi-thread/wllama.wasm":  "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.5.1/esm/multi-thread/wllama.wasm",
};

// Singleton — the model, once loaded, stays resident for the rest of the
// browser session so repeated lessons don't reload 3 GB each time.
let wllamaInstance: Wllama | null = null;
let loadPromise: Promise<Wllama> | null = null;

export const offlineAI = {
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
   * subsequent calls reuse the in-flight or completed load.
   */
  async download(onProgress?: (pct: number) => void): Promise<void> {
    if (wllamaInstance) { onProgress?.(100); return; }
    if (loadPromise)    { await loadPromise; onProgress?.(100); return; }

    localStorage.setItem(STATUS_KEY, "downloading");

    // Tracks whether the FILE itself finished downloading (reached
    // 100%) before any failure — this is what distinguishes a genuine
    // network/download failure from what turned out to be the real
    // bug report: the file downloads fine, then *loading* it (parsing
    // the GGUF, allocating the KV cache, WebGPU buffer setup) fails
    // afterward — usually out-of-memory on a budget-RAM phone, made
    // worse by wllama's default of offloading every layer to GPU
    // (n_gpu_layers unset ⇒ 99999) since that's extra memory pressure
    // on top of the WASM heap. The old code surfaced ANY failure here
    // as "Download failed. Check your connection" even when the
    // download itself had completed, which is actively misleading —
    // and worse, gave up immediately instead of retrying with a
    // lighter-weight configuration that stood a real chance of working.
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
          // Small context = faster load + lower RAM. Lessons/Q&A don't need
          // 128K tokens — a few thousand is plenty and keeps this usable on
          // 3 GB RAM phones.
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
        if (!downloadFinished) throw firstError; // genuine download/network failure — no point retrying differently
        // The file downloaded fully; loading it into memory/GPU is
        // what failed. Retry once, CPU-only — meaningfully less
        // memory pressure than offloading layers to a WebGPU context,
        // and a real chance of succeeding on exactly the budget-Android
        // hardware this app targets, instead of just giving up after a
        // successful download.
        console.error("[offline-ai] GPU-accelerated load failed after a successful download, retrying CPU-only:", firstError);
        try {
          return await attemptLoad(0);
        } catch (secondError: any) {
          const err = new Error(
            "The model file downloaded completely, but your device couldn't load it into memory afterward " +
            "(this usually means it's low on free RAM). Try closing other apps/browser tabs, then try again."
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
   * Generates a response for the given system + user prompt.
   * Throws if the model hasn't been downloaded yet — callers should check
   * getStatus() === "ready" before calling this (the classroom page does).
   */
  async generate(system: string, userContent: string): Promise<string> {
    if (!wllamaInstance) {
      if (offlineAI.getStatus() === "ready") {
        // Was downloaded in a previous session — browser cache should still
        // have it, so re-initialize without re-downloading from the network.
        await offlineAI.download();
      } else {
        throw new Error("Offline model not downloaded yet. Go to Settings → AI source → Offline fallback.");
      }
    }

    const messages: ChatCompletionMessage[] = [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ];

    const result = (await wllamaInstance!.createChatCompletion({
      messages,
      max_tokens: 700,
      // Qwen3.5's own documented recommended sampling for non-thinking
      // mode (the mode this 0.8B model uses by default) — verified
      // against the model's actual HuggingFace model card, not Gemma's.
      temperature: 1.0,
      top_p: 1.0,
      top_k: 20,
    } as any)) as ChatCompletionResponse;

    return result?.choices?.[0]?.message?.content ?? "";
  },

  /** Frees the loaded model from memory (e.g. when switching away from offline mode). */
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
    offlineAI.unload();
    // Note: this does not clear the browser's own HTTP/IndexedDB cache of
    // the GGUF file — the next download() will be fast (served from cache)
    // rather than re-fetching 3 GB, which is usually what the student wants.
  },

  // ── Vision (camera) support ────────────────────────────────────────────

  getVisionStatus(): OfflineVisionStatus {
    if (typeof window === "undefined") return "not-downloaded";
    const savedModel = localStorage.getItem(VISION_MODEL_ID_KEY);
    const savedStatus = (localStorage.getItem(VISION_STATUS_KEY) as OfflineVisionStatus) || "not-downloaded";
    if (savedStatus === "downloading" && !visionLoadPromise) {
      localStorage.setItem(VISION_STATUS_KEY, "not-downloaded");
      return "not-downloaded";
    }
    if (savedStatus === "ready" && savedModel !== VISION_MODEL_ID) return "not-downloaded";
    return savedStatus;
  },

  /**
   * Downloads the mmproj (multimodal projector) file alongside the main
   * model, enabling image input. Separate from download() above —
   * ModelManager.downloadModel({url, mmprojUrl}) fetches both together
   * with combined progress, model.open() returns them as Blobs, and
   * Wllama.loadModel(blobs, ...) loads both together (wllama detects
   * which blob is which from GGUF metadata). After loading,
   * supportInputModality('image') is checked directly rather than
   * assumed — if it comes back false, this throws instead of silently
   * reporting "ready" for a combination that doesn't actually work.
   */
  async downloadVision(onProgress?: (pct: number) => void): Promise<void> {
    if (visionWllamaInstance) { onProgress?.(100); return; }
    if (visionLoadPromise)    { await visionLoadPromise; onProgress?.(100); return; }

    localStorage.setItem(VISION_STATUS_KEY, "downloading");

    visionLoadPromise = (async () => {
      const modelManager = new ModelManager({ parallelDownloads: 6, allowOffline: true });
      const source = await getHFModelSource({ repo: HF_REPO, file: HF_FILE, mmprojFile: HF_MMPROJ_FILE });
      const model = await modelManager.downloadModel(source, {
        progressCallback: ({ loaded, total }) => {
          if (total > 0) onProgress?.(Math.round((loaded / total) * 100));
        },
      });
      const blobs = await model.open();

      const wllama = new Wllama(CONFIG_PATHS, { parallelDownloads: 6, allowOffline: true });
      await wllama.loadModel(blobs, { n_ctx: 4096 });

      if (!wllama.supportInputModality("image")) {
        await wllama.exit();
        throw new Error("This model/mmproj combination loaded but does not actually support image input.");
      }
      return wllama;
    })();

    try {
      visionWllamaInstance = await visionLoadPromise;
      localStorage.setItem(VISION_STATUS_KEY, "ready");
      localStorage.setItem(VISION_MODEL_ID_KEY, VISION_MODEL_ID);
    } catch (e) {
      localStorage.setItem(VISION_STATUS_KEY, "error");
      visionLoadPromise = null;
      throw e;
    }
  },

  /**
   * Generates a response from a system prompt, user text, and a single
   * image — the offline, on-device equivalent of the Gemini vision calls
   * used elsewhere in the app. Throws if vision mode hasn't been
   * downloaded (see downloadVision above) — callers should check
   * getVisionStatus() === "ready" first.
   */
  async generateWithImage(system: string, userContent: string, imageBytes: ArrayBuffer): Promise<string> {
    if (!visionWllamaInstance) {
      if (offlineAI.getVisionStatus() === "ready") {
        // Was downloaded in a previous session — browser cache should
        // still have both files, so re-initialize without re-fetching.
        await offlineAI.downloadVision();
      } else {
        throw new Error("Offline vision not downloaded yet. Go to Settings → AI source → Offline fallback → enable camera.");
      }
    }

    const messages: ChatCompletionMessage[] = [
      { role: "system", content: system },
      { role: "user", content: [
        { type: "image", data: imageBytes } as ChatCompletionMessageContent,
        { type: "text", text: userContent } as ChatCompletionMessageContent,
      ] },
    ];

    const result = (await visionWllamaInstance!.createChatCompletion({
      messages,
      max_tokens: 700,
      temperature: 1.0,
      top_p: 1.0,
      top_k: 20,
    } as any)) as ChatCompletionResponse;

    return result?.choices?.[0]?.message?.content ?? "";
  },

  async unloadVision(): Promise<void> {
    if (visionWllamaInstance) {
      await visionWllamaInstance.exit();
      visionWllamaInstance = null;
      visionLoadPromise = null;
    }
  },

  clearVision() {
    localStorage.removeItem(VISION_STATUS_KEY);
    localStorage.removeItem(VISION_MODEL_ID_KEY);
    offlineAI.unloadVision();
  },

  modelInfo: {
    repo: HF_REPO,
    file: HF_FILE,
    approxSizeGB: 0.55,
  },
  visionModelInfo: {
    repo: HF_REPO,
    file: HF_MMPROJ_FILE,
    approxExtraSizeGB: 0.2, // mmproj-F16.gguf, verified 205 MB on the repo's real file listing
  },
};
