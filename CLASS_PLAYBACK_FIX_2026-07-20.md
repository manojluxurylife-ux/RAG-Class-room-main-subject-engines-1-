# Class Breaks on Start / Malayalam Silent / Whiteboard Unused (2026-07-20)

## The single root cause behind all three symptoms

Traced `startClass()` → `playSceneAt()` → `narrate()`, the actual
playback chain the "Start Class" button runs. Every scene from a
prepared teaching pack plays in three narration steps in sequence:
**read the source page** (in the textbook's original language, e.g.
English) → **explain** (in the student's chosen teaching language,
e.g. Malayalam) → **solve on the whiteboard** (also in the teaching
language, whiteboard active for this step only).

`narrate()`'s existing behavior when no voice is found for a language:
call `finish()` **synchronously, in under a millisecond** — no delay,
no minimum wait. The whiteboard's on-screen window is only as long as
that near-zero gap before it flips back off.

**On a device with no Malayalam voice installed** (very common — most
Android builds don't ship regional-language voice packs pre-installed;
installing one requires a manual trip to Settings → Language →
Text-to-speech that most users never make, and this app's own target
audience is budget Android phones):

- The **read** step succeeds normally (English usually has a voice) —
  the student hears a page being read.
- The **explain** step (Malayalam) fails its voice lookup and skips in
  under a millisecond — no Malayalam speech, ever.
- The **solve** step (Malayalam, whiteboard-on) does the same — the
  whiteboard's play window opens and closes faster than a human can
  perceive, so it never visibly writes anything.
- This repeats scene after scene: the class visibly does nothing but
  "read a page, flicker, read the next page" — which is exactly what
  "it breaks the class" / "starts reading from the beginning" describes
  from the outside, even though technically each scene is progressing
  once, not literally restarting.

**One mechanism, three symptoms.** The only prior indication anything
was wrong was a single line of small, dim (`text-chalkdim`) status
text — easy to miss entirely while watching an active "class."

## The fix

**`lib/web-speech.ts`:**
- New `hasVoiceFor(languageId)` — checks voice availability for a
  language upfront, reusable and independently testable.
- New `minDisplayDurationMs(textLength, teachingSpeed)` — a pure,
  extracted formula giving any narration step (with or without real
  audio) a sensible minimum time on screen: 4s floor, 60s ceiling,
  scaling with text length and teaching speed. Same shape as the
  existing real-speech watchdog, tuned for "long enough to read/watch
  along silently" rather than "generous timeout for real audio."
- New `__resetVoiceCacheForTests()` — test-only, not used by app code;
  needed because the voice list is deliberately cached at module level
  (an earlier latency fix), which otherwise makes it untestable across
  multiple device-voice scenarios in one process.

**`app/(student)/rag-classroom/page.tsx`:**
- `narrate()` — a missing voice (or no `speechSynthesis` at all) now
  still finishes no earlier than `minDisplayDurationMs()`, instead of
  synchronously. The whiteboard's play window (opened at the top of
  `narrate()`, unchanged) now gets that same real time to run — so a
  silent scene is still genuinely watchable via whiteboard + on-screen
  text, not skipped in under a millisecond.
- `startClass()` — now checks `hasVoiceFor(teachingLanguage)` upfront,
  before playback begins, and — if missing — shows a new **prominent,
  dismissible amber banner** (not just the small dim status line)
  explaining plainly that narration will be silent, why, and how to
  fix it (install the voice, or switch teaching language). The class
  still starts either way; this is purely about the student
  understanding what's happening, since the underlying playback is now
  fixed to work properly either way.
- `changeTeachingLanguage()` — clears the (now stale, for the old
  language) warning when the student switches languages, so
  `startClass()` can re-check fresh for the new one.

## What was NOT the cause (checked and ruled out)

Investigated whether "restarts from the beginning" might instead mean
scene position wasn't being persisted between visits. Confirmed
`syncScene()` calls `classroomProgress.set(doc, { scene: next, ... })`
on every scene change during playback — position IS correctly saved as
the class progresses, and the "Resume Class" button label (shown once
`classStarted` is true) correctly reflects this. This was not the
mechanism; the voice-cascade explanation above accounts for the
reported behavior fully on its own.

## Honest limitation, not hidden

This fixes the *code's* handling of a missing voice — it cannot make a
voice exist on a device that doesn't have one installed. Malayalam (and
other regional-language) TTS quality and availability genuinely varies
by device and browser; this was already an acknowledged limitation in
`lib/web-speech.ts`'s own header comment. What changes: the student now
gets a clear, upfront, actionable explanation instead of a confusing
silent near-instant skip through every scene, and the class remains
genuinely usable (whiteboard + text) even without audio, rather than
looking broken.

## Verification

- `tsc --noEmit`: one pre-existing, unrelated error (the `rag-classroom`
  "Save to Drive" dead function reference, flagged in an earlier
  session).
- New `tests/voice-availability.test.ts` (7/7): voice-found and
  voice-missing cases, an ungendered-voice fallback case (the realistic
  common shape of many Android system voices), an explicitly-male-only
  case, and three tests on `minDisplayDurationMs()`'s floor/ceiling/
  speed-scaling behavior.
- All 5 other existing test suites still pass (37/37).
- Full `next build` via `npm run build`: clean, 74/74 pages.

## Reminder: this codebase still predates three earlier fixes

Same as flagged in the last delivery — this uploaded copy still does
not contain the PDF-upload robustness hardening, the study-material
generation token-budget fix, or the "please log in" session-mismatch
fix. All three remain unfixed here regardless of today's change. See
`PROMPT_FOR_OTHER_PLATFORM.md` (delivered earlier) for exact instructions
to bring them into whichever copy you continue developing.
