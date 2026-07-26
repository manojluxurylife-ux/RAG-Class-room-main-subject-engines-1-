# Split View: English Source + Malayalam Explanation, Tracking Playback (2026-07-21)

## What was checked first

The screenshot's exact layout couldn't be matched to the current live
code — the "AI Teacher" panel, as it existed before this change,
rendered exactly one static block (`s.narration`) for the whole scene,
regardless of the screenshot showing what looked like two distinct
text areas. Rather than guess at reproducing an unclear prior state,
traced what's actually there today and built the feature properly on
top of it.

**The real gap, confirmed by reading the code:** Phase 1's paragraph
units and Phase 2's Gemini voice already made the *audio* progress
paragraph by paragraph (read → explain → whiteboard, one paragraph at
a time). But the on-screen text never followed along — it showed the
same whole-block text the entire time a scene played, with zero
connection to which paragraph was actually being read or explained.
This delivery is the on-screen counterpart to that already-working
audio sequencing.

## The fix

New `activeUnitIndex` state tracks which paragraph unit is currently
playing within the active scene. It resets to the first paragraph
whenever the scene changes, and updates the instant playback moves to
each new paragraph (`playUnit()`, the function already driving the
Phase 1/2 audio sequence).

The "AI Teacher" panel now renders a split view whenever a scene has
paragraph units:

- **Upper box** — the current paragraph's extracted English source
  text, labeled "Extracted text · read by browser," with the actual
  source language shown.
- **Lower box** — that same paragraph's Malayalam (or whichever
  teaching language is selected) explanation, labeled "Explained by
  Gemini · then on the whiteboard" when a whiteboard step follows it.
- A "Paragraph 2/4" counter above both, so progress is visible, not
  just felt.

Both boxes update together, automatically, as playback advances
through each paragraph — because they're now driven by the exact same
`activeUnitIndex` state the audio sequencing already uses, not a
separate, independent display.

**Scenes without paragraph units** (older materials, or content too
short to split — the same fallback condition from Phase 1) render
exactly as before: the single whole-block view, completely unchanged,
zero risk to existing content.

## Verification

- `tsc --noEmit`: clean, zero output.
- All 16 existing test suites still pass (108/108) — this is a display
  change built on top of already-tested playback logic
  (`buildTeachingUnits`, the paragraph-unit sequencing itself); no new
  pure logic was introduced that needed its own test file.
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** client bundle: confirmed the new
  "read by browser" / "Explained by Gemini" labels are genuinely
  present in what ships.

## Honest note

This makes the *display* track the paragraph the audio is currently
on — it doesn't change what gets read or explained, which was already
correct from Phase 1/2. If the audio itself sounds out of step with
what's on screen for any specific lesson, that would point to the
underlying paragraph/explanation pairing from `buildTeachingUnits()`
(a proportional match, documented as an approximation in Phase 1's
delivery notes), not this display layer.
