# Whiteboard & Visuals Fix — RAG Classroom / Material Studio (2026-07-19)

**Reported defect:** AI lessons and study materials contain only plain text —
no graphs, diagrams or pictures — and the whiteboard writes only one or two
lines instead of teaching a proper class, even though all the visual
libraries (DiagramRenderer, WhiteboardCommandEngine, GeoGebra, molecule,
circuit, 3D) are present and working.

**The libraries were never broken.** Four defects upstream meant valid
visual/whiteboard data almost never reached them:

## Root cause 1 — output token caps guaranteed truncation

- The server's `callGemini` was hard-capped at **1,536 output tokens**,
  while `/api/rag/lesson` asks for 4–6 scenes each carrying up to 24
  whiteboard commands plus visuals. The JSON physically cannot fit, so it
  truncated every time, `parseAiJson` failed, and the route's `catch`
  **silently returned its hand-built 3-scene plain-text fallback** — which
  is exactly the lesson you were seeing.
- The BYOK client capped at **8,192 tokens** — still too small for the
  6–9 scene whiteboard-first lesson. jsonrepair salvaged a prefix of the
  truncated JSON, so early scenes looked fine while every scene after the
  cut lost its `whiteboardCommands` and `visual` fields.

**Fix:** `callGemini` and `callGeminiClient` now take per-call options.
Defaults unchanged (short Q&A stays cheap); structured generators pass
real budgets: BYOK lesson 32,768 · multi-agent specialists 24,576 ·
server lesson / material-studio / exam papers 16,384. All structured
calls also set `responseMimeType: "application/json"`, which sharply
improves schema compliance. (The exam-paper start routes hit the same
1,536 wall — fixed in the same pass.)

## Root cause 2 — prompt templates modelled the failure

The JSON shape shown to the model literally contained
`"whiteboardCommands":{...,"commands":[]}` and `"visual":{}`. Models copy
templates verbatim — so even untruncated responses regularly came back
with empty command arrays (→ fallback wrote just the 1–2 board bullets)
and empty visual objects (→ auto-flowchart noise or nothing).

**Fix:** every template (client lesson, multi-agent `shape`, server
material-studio) now shows a **populated 3-command example**, and
`WHITEBOARD_COMMAND_JSON_INSTRUCTION` explicitly requires **6–24 commands
per explain/solve scene, never an empty array, never fewer than 4 for a
taught scene**. Visual fields say "omit entirely when skipping — never
send `{}`".

## Root cause 3 — the two visual instructions contradicted each other

`VISUAL_JSON_INSTRUCTION` said *"at most 1–2 visuals in the whole lesson,
skip entirely otherwise"* while the whiteboard-first prompt said *include
a visual whenever the textbook content supports one*. Models resolved the
conflict conservatively: no visuals.

**Fix:** `lib/visual-generation.ts` now exports two instructions built on
one shared `VISUAL_SCHEMA_LIST`:

- `VISUAL_JSON_INSTRUCTION` (unchanged, conservative) — still used for
  standalone notes/flashcards, where a diagram is the exception.
- `LESSON_VISUAL_INSTRUCTION` (new) — used by the RAG classroom (client
  and server) and the multi-agent pipeline: *include a visual on every
  scene whose content is visualizable (graph, geometry, fraction, number
  line, data, process, circuit, molecule, cell); a normal lesson on such
  content has 2–4 visuals; never invent unsupported pictures.*

The multi-agent **visual-specialist** had the same contradiction ("one
visual per section" + "at most 1–2 total") — it now uses the schema list
with a per-section rule (`null` for non-visualizable sections).

## Root cause 4 — the fallback board was itself a bad teacher

When AI whiteboard data was missing, `planFromBoardLines` wrote only the
scene's `board` array — often one or two bullets, sometimes one 500-char
paragraph blob. That IS the "one or two lines, no proper class" board.

**Fix:** the fallback now (a) splits long prose lines into
sentence-sized board lines (Malayalam । supported), and (b) when the
board still has fewer than 3 lines, pulls the scene's narration onto the
board so the whiteboard follows the teacher. `normalizeWhiteboardPlan`
accepts the narration as a third argument; all lesson/material call
sites pass it. The existing behavior for **valid** AI plans is untouched
(covered by test).

## Verification

- `tsc --noEmit` clean; `next build` clean, 74/74 pages.
- New `tests/whiteboard-visuals.test.ts` (6/6): empty-commands →
  real multi-line board; long-line sentence splitting; valid plans pass
  through unchanged; templates contain no `"commands":[]`; lesson vs
  material visual instructions; malformed-visual fallback still works.
- Existing suites still green: whiteboard 4/4, security 6/6.

## What you should see now

Teach a topic in RAG Classroom (BYOK): the whiteboard should write the
key lines/steps one by one with laser/underline/arrows through most of
the class, and lessons on visualizable topics should show 2–4 real
diagrams (graph/geometry/flow/circuit/etc.) in the Teacher diagram panel.
If a specific subject still comes out sparse, tell me which
topic/textbook page — the remaining lever is per-subject prompt tuning,
not plumbing.
