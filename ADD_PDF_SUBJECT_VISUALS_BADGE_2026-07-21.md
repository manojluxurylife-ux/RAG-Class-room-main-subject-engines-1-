# Add Another PDF + Subject-Aware Visuals + Subject Badge (2026-07-21)

## 1. "Add Another PDF" — resets Material Studio for a new textbook

New button in the "Created study materials" header, styled distinctly
(green/leaf) from the amber "Create" and red "End" actions nearby.
Clicking it:

- Clears the active document selection and every upload-form field
  (subject, syllabus, PDF language, learning language, topic, PDF file,
  upload status) back to blank, so the next upload starts genuinely
  fresh rather than inheriting the previous book's details.
- Clears the progress grid (`batchStatus`/`batchSummary`) so it doesn't
  show stale status from the old textbook while a new one is being set up.
- Does **not** delete the previous textbook or anything already created
  for it — that stays indexed server-side and reappears (with its own
  materials) the moment it's selected again. This only clears what's
  currently showing.
- A small "cancel and go back" affordance appears while in this mode,
  in case the student changes their mind before uploading — it simply
  turns "adding new" mode back off, which lets the page's existing
  auto-select-a-document logic restore the previous textbook.

One existing effect needed a one-line change to cooperate with this:
the auto-select-first-document effect now also checks `!addingNew`, so
it doesn't fight the reset by immediately reselecting the old document
the instant it's cleared.

## 2. Subject-aware visual library guidance

New `subjectVisualGuidance(subject)` in `lib/visual-generation.ts` — a
small lookup mapping a textbook's subject (Mathematics, Physics,
Chemistry, Biology, Science, Social Science, Computer Science, English
— matching Material Studio's own subject dropdown exactly) to the
renderer types most natural for it:

- **Physics** → wave, ray-diagram, force-diagram, circuit, graph
- **Chemistry** → atom, chem-equation, molecule
- **Biology** → biology-diagram, punnett
- **Social Science** → india-map, timeline, bar-chart, flowchart
- **Computer Science** → logic-circuit, data-structure, flowchart
- **Mathematics** → graph, geometry, fraction, number-line, bar-chart,
  solid-3d, geogebra
- (Science and English get sensible broader/lighter defaults)

This is deliberately a **hint, not a restriction** — the generated
guidance text always ends by explicitly allowing any other validated
visual type when it genuinely fits a section better (a Physics chapter
with a data table still gets `bar-chart`). Wired into the one currently
**active** generation path — Material Studio's own batch-creation
prompt (`createAllStudyMaterials`) — using the subject already
collected at upload time and already stored on the document record
(`selectedDoc?.subject`), so this needed zero new data collection, only
using data that already existed.

## 3. Subject shown in RAG Classroom

The active textbook's name and subject now appear as a badge at the
very start of the classroom's main toolbar — visible regardless of
which content tab (textbook / AI teacher / whiteboard) is currently
open, unlike the language badge that already existed but only shows
inside one specific tab. Uses `activeDoc`, a value that already existed
in this file; the `subject` field was already present on the `Doc` type
and already returned from `/api/rag/ingest` — this was purely a
rendering gap, not a missing-data gap.

## Verification

- `tsc --noEmit`: one pre-existing, unrelated error (the `rag-classroom`
  "Save to Drive" dead function reference, flagged in an earlier
  session).
- New `tests/subject-visual-guidance.test.ts` (8/8): correct guidance
  per subject, confirms Chemistry guidance does NOT leak Physics-only
  renderer names, case-insensitive lookup while preserving the
  original subject-name casing in the displayed text, empty string
  (not an error) for an unknown/missing subject, and confirms the
  "any other validated type" allowance is always present.
- All 8 other existing test suites still pass (61/61).
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** client bundle (not just source):
  confirmed "Add Another PDF" text is genuinely present in what ships
  for Material Studio.

## Honest scope note

Subject-aware guidance is wired into Material Studio's own active
batch-generation prompt, which is the "one linear workflow" this app
now uses for creating materials (per the code's own comment from an
earlier session). It is exported and available for the other,
less-actively-used generation paths (`app/api/rag/lesson/route.ts`,
`lib/multi-agent-materials.ts`, etc.) if you want it wired there too —
say the word and I'll extend it to those as well.
