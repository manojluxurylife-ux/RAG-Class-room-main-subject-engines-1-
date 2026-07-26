# Paragraph-by-Paragraph Teaching (Phase 1 of 2) — 2026-07-21

First of the two pieces agreed on: restructure lesson playback so a
whole page isn't read in one uninterrupted block. The second piece
(real Gemini-generated female-voice audio for local languages) is a
separate, larger follow-up — this delivery is playback restructuring
only, no new AI capability required.

## Root cause (confirmed in code, not assumed)

Each PDF page is OCR'd and stored as one text blob per page — never
split into paragraphs. `buildPreparedTeachingPack()` used that entire
blob as a single scene's `sourceNarration`, so the classroom read an
entire page's worth of English in one pass before any explanation
began. This is exactly the "distraction" reported.

## The fix

**New `lib/paragraph-units.ts`** — pure, dependency-free text logic:

- `splitIntoParagraphs(text)` — uses real blank-line breaks when the
  text has them; otherwise falls back to clustering sentences into
  paragraph-sized groups (2-4 sentences), since OCR'd/flattened text
  frequently has no paragraph breaks left at all. Sentence splitting
  correctly avoids breaking on abbreviations (`Dr.`, `e.g.`) and
  decimal points (`2.5`), and supports Malayalam/Hindi sentence-ending
  punctuation (`।`, `॥`).
- `buildTeachingUnits(source, explanation, solve)` — splits the source
  into paragraphs, then distributes the explanation and whiteboard/
  solve text across a matching number of chunks, in original sentence
  order. Returns `[]` (an explicit "no real paragraph structure here,
  use the old whole-block behavior") for short/single-paragraph
  sources, rather than forcing a split that wouldn't help.

**Honest limitation, stated plainly in the code comment too:** the
explanation text wasn't originally written paragraph-by-paragraph — a
proportional split is a *pacing* approximation, not a guaranteed exact
content correspondence to the source paragraph it's paired with. It
works well when the explanation follows the source's own order, which
is the normal case for a linear textbook passage.

**`lib/prepared-teaching-pack.ts`** — each scene now also carries a
`paragraphUnits` array built from its own source/explanation/solve
text, alongside the original whole-block fields (kept fully intact,
unchanged) for backward compatibility.

**`app/(student)/rag-classroom/page.tsx`** — `playSceneAt()`'s "unit"
phase now checks for `paragraphUnits`. When present, it plays through
them one at a time: read paragraph → its own explanation right after
(sequenced to feel like the AI just heard that paragraph and is now
explaining it) → a whiteboard step for that same paragraph — before
moving to the next paragraph. Status text now says "paragraph 2/4 of
[topic]" so the pacing is visible, not just felt. A unit whose
explanation or solve text came back empty (see the honest limitation
above) skips that step cleanly rather than narrating nothing. Scenes
without `paragraphUnits` (older materials, or a source too short to
usefully split) fall through to the *exact original* whole-block
behavior — unchanged, zero risk to existing content.

## Verification

- `tsc --noEmit`: one pre-existing, unrelated error (the `rag-classroom`
  "Save to Drive" dead function reference, flagged in an earlier
  session) — zero new errors despite touching the core playback
  function.
- New `tests/paragraph-units.test.ts` (9/9): blank-line splitting,
  sentence-cluster fallback for unstructured OCR text, abbreviation/
  decimal-safe sentence boundaries, no over-shredding of short text,
  empty-input handling, correct pairing of source/explanation/solve
  chunks, the empty-array fallback signal, graceful handling of
  missing explanation/solve text, and — importantly — a test proving
  no sentences are lost or duplicated when explanation text is
  redistributed across units.
- All 9 other existing test suites still pass (69/69).
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** client bundle for the RAG Classroom
  page: confirmed `paragraphUnits` is genuinely present in what ships.

## Next: Phase 2

Real Gemini-generated female-voice audio for local-language narration,
replacing reliance on the browser's often-missing local-language voice
— verified feasible against Gemini's actual current TTS API
(`gemini-3.1-flash-tts-preview`, `responseModalities:["AUDIO"]`) in the
prior message. This will reuse the existing key-rotation system
(`withKeyRotation` in `lib/student-key.ts`) and fit the same
"prepared once, replayed forever" architecture as everything else in
this app — generate and store audio once per local-language paragraph
unit at material-creation time, not live during class.
