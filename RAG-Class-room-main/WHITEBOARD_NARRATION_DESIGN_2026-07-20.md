# Per-Line Whiteboard Narration — Schema + Prompt Design (2026-07-20)

Design phase for true "teacher speaks while writing" synchronization —
schema and generation prompt only, as agreed. Playback wiring comes
next once this design is confirmed.

## What was found investigating first

Traced the full data path from generation to the currently-active
playback format (`prepared-browser-v3-synchronized-units`, what
`buildPreparedTeachingPack()` produces from Material Studio-prepared
content). Found the gap is bigger than "one narration block plays
alongside one whiteboard timeline" — today, a scene's `explanationNarration`
comes from a "discussion"-type stored material, `solveNarration` and
`whiteboardCommands` come from a separately-generated "whiteboard"-type
material, and the two are matched up afterward by fuzzy text-overlap
scoring (`matchingSection()`), not generated together. Retrofitting
synchronization onto two independently-generated, loosely-paired
materials would be fragile. The right fix is structural: generate the
narration WITH the command it describes, in the same call, so there's
nothing to match up afterward.

## The schema change

`lib/whiteboard-commands.ts` — `WhiteboardCommand`'s `write` variant
gets one new optional field: `narration?: string`.

**Why it lives on the command itself, not a parallel array:** commands
routinely get dropped during validation (`normalizeWhiteboardPlan`
silently filters invalid shapes, dangling target references, duplicate
ids). A parallel narration array indexed by position would silently
desync the moment a single command is dropped — keeping narration
attached to its own command makes that structurally impossible.

**Why only on `write`:** the other actions (pause/underline/circle/
erase/laser/arrow/clear) are wordless emphasis on content that was
already spoken when its `write` command played. A teacher doesn't say
"now I am circling it" — she circles while still talking about what she
just wrote.

**Fully backward compatible:** the field is optional. Existing stored
materials, and any AI output that omits it, simply have no narration on
their commands — nothing breaks, nothing is invented on their behalf
(confirmed by test: `normalizeWhiteboardPlan` does NOT synthesize
narration for AI output that omits it, so playback can correctly detect
"this material predates synchronized narration" later and fall back to
today's block-narration behavior for that scene).

**The one place narration IS synthesized:** `planFromBoardLines`, the
emergency fallback generator used when AI output is entirely missing or
broken. Since there's no richer prose to draw from in that path anyway,
it now sets `narration` equal to the line's own text — meaning even the
fallback path benefits from synchronized playback once built, rather
than only working for well-formed AI output.

## The new grouping primitive

Added `toNarratedSegments(plan)` — a pure, testable function that walks
a flat command list and groups it into the natural unit of synchronized
playback: one `write` command plus every wordless emphasis command that
immediately follows it, up to (not including) the next `write`. Each
segment carries its narration (or `null` for legacy material with none)
and its total visual duration (the sum of every command's own
`durationMs` in that segment). This is deliberately extracted as its
own pure function now, at the schema layer, rather than left as inline
logic inside the classroom page's playback code later — keeps it
independently testable and gives the future playback engine exactly
the shape it needs: iterate segments, and for each one, animate its
commands over `visualDurationMs` while speaking `narration` (or, if
`narration` is `null`, hold for that duration with no speech attempt).

## The prompt change

`WHITEBOARD_COMMAND_JSON_INSTRUCTION` is a single shared constant
referenced by **six** different prompt-builders across the codebase
(`app/(student)/material-studio/page.tsx`,
`app/api/material-studio/generate/route.ts`,
`app/api/rag/lesson/route.ts`, `lib/client-material-generation.ts`,
`lib/multi-agent-materials.ts`, plus its own definition) — updating it
once here propagates to every generation path in the app without
touching each call site.

Added an explicit, required section: every `write` command's narration
must be a complete, natural spoken sentence in the same language as the
rest of that scene — explicitly **not** a flat readout of the symbols
in `text`. The instruction spells out the distinction with a concrete
example: `"text":"2x + 3 = 11"` should be narrated as something like
"So we start with two x plus three equals eleven," not a bare symbol
recitation. Kept each line's narration scoped to one or two sentences —
enough to actually teach that line, short enough that the spoken pacing
still matches a single line being written, not a whole paragraph.

## Verification

- `tsc --noEmit`: one pre-existing, unrelated error (the `rag-classroom`
  "Save to Drive" dead function reference, flagged in an earlier
  session).
- All 11 pre-existing whiteboard tests still pass unchanged — confirms
  the schema extension is genuinely backward compatible, not just
  claimed to be.
- New `tests/whiteboard-narration.test.ts` (10/10): narration accepted
  and validated on write commands, still optional (backward compat),
  length/type rejected when malformed, preserved and trimmed through
  normalization, NOT invented for AI output that omits it, IS
  synthesized by the fallback generator, `toNarratedSegments()` groups
  correctly (including a legacy null-narration case and a leading-
  non-write-command edge case so nothing is ever silently dropped), and
  the prompt instruction contains the required language.
- All 5 other existing test suites + last session's voice-availability
  tests still pass (44/44 total prior to this session's 10 new ones).
- Full `next build` via `npm run build`: clean, 74/74 pages.

## Explicitly not done yet, by design

Playback (`narrate()`/`playSceneAt()` in `app/(student)/rag-classroom/
page.tsx`) has NOT been touched. Nothing currently reads or uses
`narration` or `toNarratedSegments()` at playback time — today's class
still narrates one block per step, whiteboard on its own timer, exactly
as before. This delivery is schema and prompt only, as scoped. Next
step: wire `playSceneAt()`'s "solve" (and ideally "explain") steps to
walk `toNarratedSegments()` and speak each segment's narration while
animating just that segment's commands, falling back to today's
block-narration behavior whenever a segment's `narration` is `null`.
