# Colorful Getting-Started Guide on Dashboard (2026-07-22)

Fills in Dashboard — deliberately left blank last session — with a
genuine onboarding guide for students new to the app, covering
Settings setup, Material Studio, RAG Classroom, the 11 study
materials, and exam evaluation, exactly as asked.

## Verified before writing any content

Every claim in the guide was checked against this session's actual,
current code rather than written generically:

- The exact 11 material types, pulled directly from Material Studio's
  own `BATCH_MATERIALS` list.
- The "create all 11 at the same time" behavior and the automatic
  Google Drive storage fallback — both real features built earlier
  this session, not assumed.
- The paragraph-by-paragraph teaching sequence, the whiteboard, and the
  spotlight on the textbook page — all real, verified behavior from
  recent sessions, not a generic "AI teaches you" description.
- Which material cards open as genuinely interactive viewers (PPT,
  MCQ Quiz, Flashcards) versus which open as readable notes (Notes,
  Worksheet, Mind Map, Interactive Book, Revision Notes) — confirmed
  against the actual wiring, not assumed to all behave the same.
- The chapter-test-to-Parent-Portal pipeline — confirmed end to end in
  an earlier session by tracing the real code, not asserted from a
  feature list.

## Design

`components/GettingStartedGuide.tsx` — five expandable, colour-coded
sections (leaf, marigold, indigo, sky, terracotta — this app's own
existing accent colors, matching how RAG Classroom already
color-codes its own panels, rather than a new invented palette):

1. **Settings** — activating the free Gemini key, the optional offline
   backup, the optional textbook search.
2. **Material Studio** — uploading a PDF, creating all 11 materials at
   once, the automatic Drive fallback, adding a second textbook.
3. **RAG Classroom** — starting a class, the paragraph-by-paragraph
   read-then-explain-then-whiteboard sequence, the spotlight, pausing
   to ask a doubt by camera.
4. **Using the 11 materials** — which ones are truly interactive versus
   which are notes, and asking Gemini about any of them directly.
5. **Chapter tests and results** — the automatic pop-up test, instant
   offline scoring, and the result reaching both Progress and the
   Parent Portal.

Each section starts collapsed except the first (so a genuinely new
student sees where to begin without a wall of text), expands to a
short bullet list of concrete steps, and ends with a direct "Go to
[page]" link in the section's own color — so reading the guide and
acting on it are the same click, not a separate step.

**One naming decision worth being explicit about:** last session moved
the *returning-student* experience (welcome header, stats, recent
lessons, quick shortcuts) to Settings. This guide is specifically the
*new-student* onboarding experience, and deliberately doesn't duplicate
that content — Dashboard's new job is "how do I get started," not a
second copy of "here's what I've been doing."

## Verification

- `tsc --noEmit`: clean, zero output.
- All 19 existing test suites still pass (129/129) — this is new page
  content with no logic worth separately unit-testing (it's a static,
  verified-content guide, not computation).
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** output: confirmed the guide's title
  and content (including the "all 11 material types" line) are
  genuinely present in the Dashboard page bundle, not just in source.
