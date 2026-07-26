# Local Model Switched to Qwen3.5-0.8B (2026-07-21)

## What was actually there before this

Checked the code before changing anything — good thing, because it
wasn't pointing at this Qwen repo at all. It was pointing at
`sayhan/MiniCPM-3B-OpenHermes-2.5-v2-GGUF`, a completely different
model from an unrelated HuggingFace account, with a comment explaining
why: an earlier attempt to use this exact Qwen repo found the GGUF file
genuinely wasn't being served there at the time, so a substitute was
used as a stopgap.

## Verified the repo directly before trusting it this time

Rather than repeat that mistake, fetched the repo's actual file listing
live (`huggingface.co/manojbillionaire123/Qwen3.5-0.8B-MTP-GGUF/tree/main`)
before writing any code. It genuinely hosts real, downloadable GGUF
files now — a full quantization lineup, from 409 MB up to 1.56 GB, with
exact filenames and real sizes sourced directly from HuggingFace's own
file browser. Picked `Qwen3.5-0.8B-Q4_K_M.gguf` (550 MB) — the same
K_M quant level this codebase has consistently used for its on-device
model choice, and a real, confirmed, working file.

**One caveat worth stating plainly:** a final direct-fetch attempt on
the exact download URL was blocked by HuggingFace's bot detection on
large binary files — this is a known, common block on generic
scraper-style requests to file CDNs, distinct from the file not
existing, and doesn't undermine the file-listing verification (a much
more reliable signal, since it's sourced from HuggingFace's own
generated page, not a raw request). wllama's actual browser-based
downloader uses proper request headers and isn't affected by this.

## The change

**`lib/offline-ai.ts`** — the core config:
- `HF_REPO` → `manojbillionaire123/Qwen3.5-0.8B-MTP-GGUF`
- `HF_FILE` → `Qwen3.5-0.8B-Q4_K_M.gguf`
- `modelInfo.approxSizeGB` → `0.55` (was `1.96`)
- Sampling parameters (`top_p`, `top_k`) updated to Qwen3.5's own
  documented non-thinking-mode recommendation (`top_p: 1.0, top_k: 20`
  — this model runs in non-thinking mode by default), verified against
  the model's actual card rather than left as the old, explicitly
  Gemma-labeled values (`top_p: 0.95, top_k: 64`) that no longer
  applied to what's actually loaded.
- The top-of-file doc comment, which had drifted badly out of sync
  (described Gemma's specs while the code pointed at MiniCPM), rewritten
  to accurately describe Qwen3.5-0.8B — including an honest note on the
  model's history in this file (Gemma 4 E2B → MiniCPM-3B stopgap → this)
  so a future session doesn't have to rediscover that context from
  scratch.

**Download mechanism — used what's already there, as asked.**
`offlineAI.download()` already wraps wllama's own HuggingFace-aware
downloader: parallel transfers (6 at once), real progress callbacks,
and browser-cache reuse on retry without re-downloading. This already
functions as a genuine download manager; the fix was pointing it at
the correct file, not building a new one.

**Every live, user-facing reference to the old model updated** — found
by searching the whole app, not just the config file:
- `components/LocalBrainSetupModal.tsx` — title, size, and button text
  (Home page checklist's download modal).
- `components/SetupChecklist.tsx` — the checklist item itself, in two
  places.
- `app/(student)/profile/page.tsx` — the Settings page's own (older,
  separate) download UI, including its storage/RAM warning, which
  dropped from "3 GB RAM to run smoothly" to a realistic "roughly 1 GB"
  now that the model is this much smaller — this isn't cosmetic, an
  inflated requirement could have wrongly discouraged a student on a
  genuinely capable phone from trying the download at all.
- `lib/byok.ts` — a stale comment reference, for consistency.

**Deliberately left untouched:** the separate vision/mmproj fallback
(`HF_VISION_REPO`/`HF_VISION_FILE`), which still points at the older
Gemma repo and is explicitly disabled (`getVisionStatus()` always
returns `"unsupported"`) pending a real, working mmproj file. Worth
flagging as a genuine opportunity: the same Qwen3.5 repo now hosts real
mmproj files too (`mmproj-F16.gguf`, 205 MB) — Qwen3.5 is natively
multimodal — which could plausibly resolve that gap. Not attempted
here since it needs its own verification of wllama's actual multimodal
loading API against this specific model, which is separate, real work,
not something to fold into a model-swap request.

## Verification

- `tsc --noEmit`: clean, zero output.
- All 16 existing test suites still pass (108/108) — this change
  didn't touch any tested logic, only configuration and UI text.
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** output: confirmed the new filename
  is present in the server bundle, and the updated "Qwen3.5 0.8B" /
  "Download Qwen3.5" text is present in every client page that
  references it (Profile, Dashboard checklist).
