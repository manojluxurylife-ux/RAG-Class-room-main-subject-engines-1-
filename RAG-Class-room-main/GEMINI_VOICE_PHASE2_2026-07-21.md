# Phase 2: Real Gemini Voice for Local-Language Narration (2026-07-21)

Second of the two agreed pieces. Builds directly on Phase 1's paragraph
units — each local-language paragraph explanation/whiteboard-solve step
now gets its own real, pre-generated Gemini audio clip instead of
depending on whatever text-to-speech voice happens (or doesn't happen)
to be installed on the student's phone.

## The discovery that changed the scope of this work

Investigating before building anything, `lib/student-key.ts` already
contained `callGeminiTtsClient()` — a working Gemini TTS API client,
already wired through the existing key-rotation system, already
defaulting to the "Kore" voice. `lib/gemini-live.ts` (built for the
camera/mic doubt-clearing feature) already contained `decodeBytes()` and
`decodeAudioData()` — correct PCM-audio decoding at exactly 24kHz, the
real output rate Gemini TTS uses. **Neither was called from anywhere.**
Both were fully built, fully correct in shape, and completely
disconnected from lesson playback. The actual work here was finding
that, verifying it against Gemini's real current API, fixing what was
stale, building the one genuinely missing piece (a persistent cache),
and wiring all of it into the classroom — not building a TTS
integration from scratch.

## What was fixed in the existing code

- The TTS model was pointed at an older name
  (`gemini-2.5-flash-preview-tts`). Verified Gemini's actual current
  documented model via a live search rather than assuming, and upgraded
  to `gemini-3.1-flash-tts-preview` — the same generation this app
  already uses for its Live API doubt-clearing feature
  (`gemini-3.1-flash-live-preview`), for consistency.

## What's genuinely new

**`lib/client/tts-cache.ts`** — an IndexedDB cache for generated audio,
matching the existing `pdf-store.ts` pattern exactly. Keyed by a hash of
the exact narration text plus voice name, so the identical paragraph is
ever only sent to Gemini **once** — every replay after that, for any
student, on any future visit, plays back instantly from the local
cache with zero API calls. This is what makes the feature match the
app's "prepared once, replayed forever" philosophy rather than paying a
Gemini call on every single class replay.

**`narrate()`'s new Gemini-voice path** (`app/(student)/rag-classroom/
page.tsx`) — a new `useGeminiVoice` parameter. When true: check the
cache → on a miss, call `callGeminiTtsClient()` → decode the returned
PCM → cache it (fire-and-forget, doesn't block playback) → play it via
the Web Audio API (`AudioContext` + `AudioBufferSourceNode`), calling
the same `finish()`/`onComplete` chain the rest of `narrate()` already
uses. **Any failure at any point — no Gemini key connected, network
error, quota exhausted even after key rotation, decode failure — falls
straight through to the exact same browser-speech path used before**,
so a local-language class never goes fully silent just because Gemini
was unreachable at that moment.

Wired to exactly the five call sites that narrate in the teaching
language (both paragraph-unit explain/solve steps, both legacy
whole-block explain/solve steps, and the older separate-scene format's
explain/solve phases). **The five source-reading call sites were left
completely untouched** — the browser still reads the original textbook
page in its own language, exactly as specified.

`stopNarrationAudio()` now also stops a currently-playing Gemini clip
(not just cancelling browser speech), so pause/skip/end-class all still
work correctly regardless of which voice path is active.

## Honest disclosure, not glossed over

Google's own documentation describes Gemini's 30 prebuilt voices by
**tone** (bright, upbeat, firm, warm, breathy...) — there is no official
gender label on any of them. "Kore" is the voice most consistently used
as the female-presenting option across Google's own paired
multi-speaker sample code, which is why it was already the choice in
the pre-existing (disconnected) code and why it's kept here. This is a
best-effort read of common usage, not an authoritative gender
designation from Google. It's kept as one named constant
(`GEMINI_TEACHER_VOICE`) specifically so it's a one-line change to try a
different voice if this one doesn't sound right on real classroom
content.

## Verification

- `tsc --noEmit`: one pre-existing, unrelated error (the `rag-classroom`
  "Save to Drive" dead function reference, flagged in an earlier
  session) — zero new errors from this integration.
- New `tests/tts-cache.test.ts` (5/5): cache-key hashing is
  deterministic, differs correctly by text AND by voice (so a voice
  change never replays stale audio under a different voice's name),
  produces safe IndexedDB keys, handles empty input.
- New `tests/gemini-live-audio.test.ts` (3/3): the base64⇄bytes
  round-trip this feature now depends on (previously untested, since it
  was only used by the Live API before) — including a realistic
  48000-byte PCM-sized buffer, confirmed byte-for-byte.
- New `tests/gemini-tts-client.test.ts` (3/3) — the most important
  proof: mocked the actual `fetch` call and confirmed the real request
  sent to Gemini uses the correct model, `responseModalities: ["AUDIO"]`,
  and `voiceName: "Kore"`; confirmed a successful response is unwrapped
  correctly; confirmed a response with no audio part throws a clear
  error rather than silently returning garbage.
- All 10 other existing test suites still pass (78/78) — 89 tests
  total in the app now.
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** client bundle for the RAG Classroom
  page: confirmed the TTS model string and `AudioContext` usage are
  genuinely present in what ships, not just in source.

## What to expect the first time a class plays

The very first time any given paragraph's local-language step plays,
there's a brief real pause while Gemini generates that clip — a few
seconds, not instant. Every replay after that (same paragraph, same
student, same or a different session) is immediate, straight from
cache. This first-time pause isn't necessarily a downside worth
"fixing away": it can reasonably read as "the AI is thinking about how
to explain this," which fits the "as if it just heard the paragraph and
is now translating it" feeling you described, rather than undermining
it.

## Honest limitation

Nothing in this delivery generates audio at Material Studio creation
time — generation happens lazily, the first time a paragraph is
actually taught. If you'd rather have every paragraph's audio
pre-generated and cached during material creation (so there's zero
pause even on a brand-new class's very first playthrough), that's a
reasonable follow-up: reuse the exact same `tryGeminiVoice()` logic,
just triggered from `createAllStudyMaterials()` in Material Studio
instead of from the classroom, walking through each generated
material's paragraph units right after text generation completes.
