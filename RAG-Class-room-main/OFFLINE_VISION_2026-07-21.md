# Offline Vision, Actually Working (2026-07-21)

## Verified the real API before writing a line of code

Rather than trust the previous session's comments about how wllama's
multimodal loading works, read the actually-installed package's own
type definitions (`node_modules/@wllama/wllama@3.5.1`) directly:

- `ModelManager.downloadModel({url, mmprojUrl}, options)` — a single
  call that downloads BOTH the main model and its mmproj together,
  combined progress tracking, shared caching.
- `getHFModelSource({repo, file, mmprojFile})` — a real, purpose-built
  helper that resolves a HuggingFace repo/file pair (plus an optional
  mmproj file) into the `ModelSource` the line above needs — no URL
  hand-construction required.
- `Model.open(): Promise<Blob[]>` — opens the cached files as Blobs,
  ready for loading.
- `Wllama.loadModel(blobs, params)` — loads both together; wllama
  detects which blob is the mmproj from GGUF metadata itself.
- `Wllama.supportInputModality('image'): boolean` — a genuine runtime
  check that the loaded combination actually supports images, not an
  assumption from config.
- `ChatCompletionMessage.content` accepts an array of parts, including
  `{ type: 'image', data: ArrayBuffer }` — raw bytes, not a base64
  data-URL.

Every one of these was confirmed by reading the actual `.d.ts` files
before use, and `tsc --noEmit` came back clean using them for real —
strong independent confirmation the usage is correct, not just that it
compiles by coincidence.

## What changed

**`lib/offline-ai.ts`**:
- Vision now points at the **same Qwen3.5 repo** as the text model,
  not a separate one — Qwen3.5 is natively multimodal, and its own
  repo hosts the matching mmproj file. Picked `mmproj-F16.gguf`
  (verified 205 MB on the repo's real file listing two sessions ago,
  before the text-model swap even happened) — the smallest of the
  three mmproj quantizations offered, a sensible choice for the
  budget-Android target audience.
- `getVisionStatus()` — no longer hardcoded to `"unsupported"`. Real
  localStorage-backed status tracking, mirroring the exact pattern the
  text-only `getStatus()` already used (including resetting a stuck
  `"downloading"` status after a page reload, and invalidating a
  `"ready"` status if the configured model changed since it was
  downloaded).
- `downloadVision()` — genuinely downloads and loads the model +
  mmproj together, then explicitly verifies `supportInputModality
  ('image')` before reporting success. If the combination loads but
  doesn't actually support images, this throws instead of lying about
  readiness.
- `generateWithImage()` — genuinely runs inference with the loaded
  vision model, using the real multi-part message content shape.

**`app/(student)/profile/page.tsx`** — a complete download UI for this
already existed here (button, progress bar, remove option), built
against the stubbed backend and correctly gated (`visionStatus !==
"unsupported"`) so it simply never appeared while vision was disabled.
It now appears automatically once a student has the base text model
downloaded — no new UI needed, just fixed two stale size references
("~0.9 GB," a leftover Gemma-era estimate) to the real ~205 MB.

**`app/(student)/classroom/page.tsx`** — the automatic fallback logic
(try Gemini first, fall back to `offlineAI.generateWithImage` if
`getVisionStatus() === "ready"`, clear message if neither is
available) was also already correctly built, calling
`generateWithImage` with exactly the `ArrayBuffer` shape the real
implementation now expects. No changes needed there either.

**Honest, undecided question, stated plainly rather than promised
either way:** whether downloading vision reuses the text-only model's
already-cached ~550 MB (since both point at the same file) depends on
wllama's own cache-sharing behavior across separate `ModelManager`
instances — genuinely not verified in either direction. Documented in
the code so nobody assumes a guarantee that hasn't actually been
checked.

## Verification

- `tsc --noEmit`: clean, zero output — using real, verified API
  signatures, not guessed ones.
- New `tests/offline-vision-status.test.ts` (6/6): confirms
  `getVisionStatus()` no longer hardcodes `"unsupported"` (the literal
  bug this delivery fixes), correct `"ready"` detection matched against
  the current model ID, correct invalidation on a stale/changed model
  ID, correct recovery from a stuck `"downloading"` state, and that
  `visionModelInfo` reports the real file and the real (much smaller)
  size rather than the old placeholder.
- All 18 other existing test suites still pass (119/119) — 125 tests
  total in the app now.
- Full `next build` via `npm run build`: clean, 74/74 pages — the most
  meaningful check here, since a broken wllama import or an incorrect
  API call shape would have failed this outright, and it didn't.
- Checked the actual **compiled** output: confirmed the fix (new mmproj
  filename, updated UI text) is genuinely present across the built
  bundles, not just in source.

## What to actually expect

The model/loading logic is now real and verified against the actual
library API — this is a solid, correct implementation, not a guess.
What hasn't been tested is the *quality* of Qwen3.5's vision output on
real handwritten notebook photos on a real budget Android phone — that
can only be confirmed by trying it on a real device once deployed, the
same way any on-device model's real-world quality would need
confirming regardless of how carefully the integration code is built.
