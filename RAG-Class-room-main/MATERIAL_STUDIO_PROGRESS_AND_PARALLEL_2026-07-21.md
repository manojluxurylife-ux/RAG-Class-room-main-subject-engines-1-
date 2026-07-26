# Material Studio: Progress Panel Visibility + Parallel Creation (2026-07-21)

## Bug 1 — the "Created study materials" progress panel was invisible

Traced this precisely rather than guessing from the screenshot. Found a
CSS rule in `app/globals.css`:

```css
body.material-studio-page main.space-y-5 > :nth-child(n + 4) {
  display: none !important;
}
```

Its own comment explained the original intent correctly: hide an
obsolete manual single-material generator UI that used to duplicate
controls already covered by the batch-creation flow. The rule assumed
that UI started at the 4th child of the page's `<main>`.

**The bug: a "Create Study Materials" button section was added between
the upload area and the progress panel at some point after this CSS
rule was written, shifting every section after it down by one
position — without the rule being updated to match.** That pushed the
**entire "Created study materials" panel — the progress grid, the
completion summary, and the "Create all materials again" /
"Retry failed materials" buttons — into the hidden range.** The button
to start creation was still visible (still at its original position),
but literally everything showing what happened after clicking it was
invisible. This is exactly what "a create material tab is not visible"
and "make sure the created contents are displayed... with progress"
described.

**Why a quick CSS number fix wasn't safe:** digging into what else was
in the hidden range, `error`/`result`/`materialType` state turned out to
be shared between the officially-obsolete manual generator AND the
still-needed "click a completed material card to view its content"
flow (`openCreatedMaterial`). A blind `:nth-child` position shift risked
just moving the same fragility to a different position, or accidentally
un-hiding dead code while still hiding needed code.

**The actual fix:** removed the position-based CSS hack entirely, and
instead deleted the genuinely dead JSX directly — the manual topic/
grade/language picker, the redundant material-type grid (its "open a
completed material" capability was already duplicated in the visible
progress grid), and the standalone "Generate" button + its progress
section. Left `{error && ...}`, `{result && ...}` (the completed-
material viewer), and the "index a textbook first" empty-state message
fully intact and visible, since those are genuinely still used by
`openCreatedMaterial`. This removes the entire class of bug (a magic
position number silently breaking again the next time a section is
added) rather than just patching today's instance of it.

## Bug 2 — materials were created strictly sequentially ("part by part")

The generation pipeline splits a textbook into 5 page-range "parts" and
splits the 11 material types into groups (PPT alone, MCQ alone,
flashcards alone, and two "other materials" batches) — each group gets
its own Gemini call per part, specifically so combining too many
material types into one call doesn't get truncated (a real, deliberate,
already-learned lesson in this codebase — see the code comment: "PPT
receives its own full response budget. Mixing it with five other
agents caused long textbooks to be compressed into only a handful of
slides.").

The bug: **both dimensions ran fully sequentially** — `for(part 1..5) {
for(each group) { await ... } }` — even though the groups are
completely independent of each other (they touch disjoint material
types, disjoint parts of `batchStatus`). The visible symptom was the
button literally saying "Creating part by part…" while running.

**Why this couldn't just be flattened into one big parallel burst:**
within a SINGLE group, a material's later parts read and append onto
that SAME material's earlier parts (`sections:[...(previous?.sections
||[]), ...newSections]`). If two parts for the same material finished
out of order under naive full parallelism, that read-modify-write would
race and silently drop or duplicate sections. The 5 parts for a given
group genuinely must stay sequential.

**The fix:** restructured so each group runs its own correctly-ordered
5-part pipeline (unchanged internal logic — same prompts, same
per-material retry-on-missing-output handling, same accumulation), and
the (now up to 5) independent group pipelines run **concurrently** with
each other via a new small utility, `lib/client/run-with-concurrency.ts`.
Concurrency is set to the actual group count (so all groups genuinely
run "at the same time" as requested), while the utility itself still
caps concurrency safely in case a future change ever produces more
groups than that — this isn't a naive `Promise.all` free-for-all, it's
a bounded runner that happens to have enough headroom for every current
group to run simultaneously.

Button label updated from "Creating part by part…" to "Creating all
materials at once…" to match.

## Verification

- `tsc --noEmit`: one pre-existing, unrelated error (the `rag-classroom`
  "Save to Drive" dead function reference, flagged in an earlier
  session) — zero new errors from either fix, despite a substantial
  restructure of the generation function.
- New `tests/run-with-concurrency.test.ts` (7/7): result ordering
  preserved regardless of finish order, concurrency cap genuinely
  respected (measured directly, not assumed), actually faster than
  sequential (measured elapsed time), a failing task doesn't stop
  others and its error is captured not thrown, live per-task
  `onSettled` callbacks fire as each task finishes (not batched),
  empty task list handled, concurrency-higher-than-task-count handled.
- All 7 other existing test suites still pass (54/54).
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** client bundle for the Material Studio
  page (not just source): confirmed the new "at the same time" button
  text is present and the old "part by part" text is completely gone —
  proof the fix genuinely ships, not just exists in source.

## Honest scope note

Concurrency is capped by group count (currently always ≤5), which is a
small, bounded, known number of simultaneous BYOK Gemini calls — not an
unbounded burst. This was a deliberate choice over naively flattening
every (part × group) unit into one pool of up to 25 simultaneous calls,
which would risk tripping a student's own free-tier API rate limit and
turning "faster" into "many materials failing at once." If materials
still fail more often after this change on a particular student's
account, that's the signal to investigate their specific key's rate
limit next — not a reason to remove the concurrency cap.
