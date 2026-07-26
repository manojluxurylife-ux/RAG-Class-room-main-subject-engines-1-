# Narration Latency Fix — "delay before the browser reads" (2026-07-19)

**Reported:** after the lesson moves to the next page/scene, there is a
noticeable wait before the browser starts reading the spotlighted text /
teacher note / whiteboard explanation.

Three independent causes, all in the Web Speech path, all fixed in
`lib/web-speech.ts` + the RAG classroom's `narrate()`:

## 1. Voice list stall — up to 1.8 s per scene (the big one)

Chrome/Android frequently report an EMPTY `getVoices()` for a moment
right after `speechSynthesis.cancel()` — and cancel is exactly what
every scene change does. `loadSpeechVoices()` had no cache, so whenever
that happened the narration waited the full 1800 ms `voiceschanged`
timeout before speaking a word. The voice list is now cached at module
level (and kept fresh by a persistent `voiceschanged` listener): after
the first load it resolves instantly, forever.

## 2. One giant utterance — slow synthesis start

The whole narration was one `SpeechSynthesisUtterance`. Engines
synthesize ahead before audio starts, so a 900-character paragraph
audibly lags. New `speakChunked()` splits narration into sentence
chunks (Malayalam/Hindi danda `।` supported), the FIRST chunk is always
a single sentence (starts near-instantly), and the rest chain seamlessly
in `onend`. This also sidesteps desktop Chrome's known ~15-second
long-utterance stall, with a pause/resume heartbeat as belt-and-braces.
A bad chunk skips itself instead of killing the lesson; the existing
watchdog remains the final safety net.

## 3. Cancel→speak race + cold engine

`speak()` issued in the same tick as `cancel()` is silently dropped or
delayed on Chrome/Android — the first chunk now goes out after a 60 ms
settle. Separately, the very FIRST utterance after page load pays the
device's TTS engine initialization (1-3 s on budget Androids); new
`primeSpeechEngine()` runs inside the Start Class click (a user gesture,
as speech APIs require) and speaks a silent utterance, so that cost is
paid while the lesson is still loading, not on scene 1.

## What did NOT change

Pause/resume, scene skipping, the language/voice selection logic, the
"voice not installed" message, and the watchdog all behave exactly as
before — `speakChunked` returns a handle that `stopNarrationAudio()`
cancels, so barge-in and manual navigation still cut speech instantly.

## Expected result

Scene-to-scene: reading begins ~60-150 ms after the page moves (the
settle delay plus one short sentence's synthesis) instead of 1-2+ s.
First scene: no cold-engine pause. If any delay remains on a specific
device, it is the device's own installed voices — check the browser's
speech voice settings on that device.

## Verification

- New chunking regression test in tests/whiteboard-visuals.test.ts
  (7/7): multi-chunk splitting, short first chunk, no words lost, danda
  splitting, single/empty inputs.
- `tsc --noEmit` clean; `next build` clean, 74/74 pages; all suites
  green (whiteboard 4/4, whiteboard-visuals 7/7, flowchart 8/8,
  subject-visuals 12/12, security 6/6).
