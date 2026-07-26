# RAG Classroom Material Cards — Real Interaction + a Confirmed Crash Fixed (2026-07-21)

## What was actually checked

Traced exactly what happens when a student clicks a card in the "Study
Materials Created" strip — the row of Smart Notes / PPT Slides / MCQ
Quiz / Flashcards / etc. shown at the bottom of RAG Classroom.

## What already worked

- Clicking a card with saved content correctly opens it and switches to
  a "notes" viewing tab.
- Asking Gemini a doubt about an opened material genuinely works, two
  ways: a dedicated "Ask using camera & mic" button, and the same
  highlight-text-then-ask flow already used for the main lesson content
  (confirmed the same `onMouseUp` selection handler is wired on this
  tab too).
- Clicking a card with no content yet correctly redirects to Material
  Studio with a clear explanation, rather than showing a blank/broken
  state.

## What was actually broken

**A confirmed crash, finally traced to its source.** The "Save to
Drive" button in the notes-viewer called a function,
`saveMaterialToDrive`, that doesn't exist anywhere in this file — this
is the exact dead-reference `tsc` error that has appeared in every
single type-check throughout this whole multi-session project,
previously flagged but never traced to its actual location. Found it:
clicking that specific button would throw a runtime error. Fixed with a
working local JSON download (the same pattern Material Studio's own
download button already uses) and relabeled the button "Download" so it
accurately describes what it now does. **This is the first time this
`tsc` error is actually gone**, not just worked around — confirmed by
running `tsc --noEmit` with zero output for the first time this project.

**Most material types weren't rendering as themselves.** Every card —
regardless of type — opened into the exact same plain "heading +
paragraph" text view. This app already has real, working, specialized
viewers for two of these types (`PptSlideDeck`, `McqQuizDeck` — which
internally also handles Flashcards) — Material Studio already uses them
correctly. RAG Classroom's material cards never used them at all,
meaning clicking "PPT Slides" showed slide content as a flat text list
instead of an actual slide deck, and clicking "MCQ Quiz" showed
questions as plain paragraphs with no way to select an answer or check
correctness — the options/correct-answer/explanation fields weren't
even rendered.

## The fix

- `openCreatedMaterial()` now also records which card was opened (not
  just its display label, which could theoretically be reworded later
  — the underlying card key is the stable, reliable thing to branch on).
- The notes-viewer now renders `<PptSlideDeck>` for PPT Slides,
  `<McqQuizDeck>` for MCQ Quiz and Flashcards (this component already
  internally delegates to a dedicated `FlashcardDeck` when it detects a
  flashcards-type material — also pre-existing and previously unused),
  and keeps the original flat-text view for the other 9 material types
  (Smart Notes, Worksheet, Mind Map, Interactive Book, Revision Notes,
  Lesson Plan, Teaching Script, Whiteboard Commands) — which are
  genuinely prose-style content, so the existing view is the right fit
  for them.
- The "Save to Drive" crash is fixed as described above.
- Doubt-asking was untouched — it already worked correctly and applies
  equally to whichever viewer is now shown.

## Honest scope note — found, not fixed here

Investigating this also surfaced that clicking a card rebuilds a
temporary "lesson" from that material's sections for potential
narration/whiteboard playback, but this alternate path was never
updated to use Phase 1's paragraph-by-paragraph splitting (it still
reads each section as one whole block) and never activates the
whiteboard at all (the scenes it builds never reach a "solve" phase).
This is real and worth fixing, but it's a separate, sizeable piece of
work — extending `buildTeachingUnits()` usage to this code path — not
something folded into this delivery, which focused on the specific
"can students interact with it" question that was asked.

## Verification

- `tsc --noEmit`: **clean, zero output** — the first time in this
  project's history this check has been fully clean, since the actual
  cause of the long-standing error was finally found and fixed rather
  than left as a known, tracked exception.
- All 13 existing test suites still pass (89/89) — this change touched
  only the material-card viewing path, nothing narration/whiteboard/TTS
  related.
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** client bundle: confirmed the old
  "Save to Drive" text is completely gone from what ships, and the
  surrounding "Ask using camera & mic" code region (right next to the
  edits) is present, proving this exact code shipped correctly.
