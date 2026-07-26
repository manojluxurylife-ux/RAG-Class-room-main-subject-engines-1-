# Full Pipeline Check: Upload → Class → Doubts → Exam → Parent Portal (2026-07-21)

## What was asked

Verify the whole chain works: upload a PDF in Material Studio, create
study materials, conduct a class, clear doubts, take an exam, and have
the result reach the Parent Portal — and explain how the exam/
evaluation mechanism actually works.

## The short answer

**The whole pipeline genuinely exists and is well-built.** Every stage
was traced through real code, not assumed from file names. One real,
significant gap was found in the exam-submission stage and is now
fixed.

## How the exam/evaluation system actually works

1. **Materials generation already produces exam content.** Material
   Studio's "MCQ Quiz" material type generates real multiple-choice
   questions (question, four options, correct answer, explanation,
   Bloom's-taxonomy level) per chapter, alongside the notes and
   whiteboard content — all in the same generation pass, at creation
   time, not live.
2. **`buildPreparedTeachingPack()`** attaches 5 of these questions to
   the scene marking the end of each chapter (`chapterEnd: true`,
   `chapterQuestions: [...]`).
3. **In the classroom, `openChapterTest()`** fires automatically when a
   chapter-ending scene finishes playing — pauses the class, shows a
   5-question test, and won't let the student continue to the next
   chapter until they've completed it (a real, enforced checkpoint).
4. **Scoring happens entirely client-side** — plain comparison of
   selected answers against the correct ones. No AI call, no network
   needed to grade it — consistent with this app's "prepared once"
   philosophy applied to evaluation too.
5. **The result is POSTed to `/api/student/chapter-assessments`**,
   which persists it to a real, driver-backed store
   (`chapterAssessmentsStore`, the same Upstash/Firestore/in-memory
   pattern every other store in this app uses — not a stub).
6. **`lib/child-analytics.ts` reads that same store** to compute
   mastery scores and per-subject readiness, which is what
   **`app/api/parent/child-analytics/route.ts`** serves, which is what
   **`app/parent/children/[childId]/page.tsx` — a real Parent Portal
   page — actually displays.**

Traced this by grep and by reading each file, not by trusting the
naming. It's a real, connected, working chain.

## The gap that was found and fixed

The classroom page only ever checked `studentSession.get()` — a
client-side profile that never expires and has no relationship to the
real, signed server session every API route actually enforces. This is
the exact same class of bug fixed for Material Studio in an earlier
session of this project — but checking this specific codebase directly
confirmed that fix was never actually present here (an earlier
assumption to the contrary, made a few turns ago in this same
conversation, was wrong — corrected by verifying the file directly
rather than trusting memory of a different upload).

**The real cost of this gap, specifically for exams:** the score is
calculated and shown to the student *before* the save request is sent.
If the student's session had quietly expired, the server would
correctly reject the save — but the student would still be looking at
a "you scored 4/5" screen with no clear indication that number never
actually reached their parent.

## The fix

`lib/client/verify-session.ts` — rebuilt in this codebase (checks the
real session via `/api/auth/me`, treats a network failure as "assume
valid" so a genuinely offline student is never wrongly logged out).

- `app/(student)/rag-classroom/page.tsx` now verifies the real session
  on mount, fire-and-forget, so a student with a stale session is
  caught *before* investing time in an entire class or chapter.
- `submitChapterTest()` now specifically detects a session-expired
  response and gives an honest, specific message: the score is stated
  plainly, and the student is told just as plainly that it was **not**
  saved and will **not** reach the Parent Portal, with the fix (log in
  again, retake the test) — instead of the previous vague "please
  retry" that didn't explain why or what was actually at stake.

## What was checked and confirmed already working, untouched

- Material Studio → PDF upload → indexed → all 11 material types
  created (including MCQ Quiz) — the full pipeline from earlier
  sessions this project, still intact.
- RAG Classroom teaching: paragraph-by-paragraph pacing, Gemini voice
  for local-language narration, synchronized whiteboard, PDF/notes/
  whiteboard page sync — all from this project's prior work, unaffected.
- Doubt-clearing: both the dedicated camera/mic button and the
  highlight-text-then-ask flow, confirmed working in an earlier check
  this session.
- The exam mechanism's actual scoring, storage, and parent-facing
  display logic — all confirmed genuinely correct; nothing there needed
  changing, only the session-validity gap around it.

## Verification

- `tsc --noEmit`: clean, zero output.
- New `tests/verify-session.test.ts` (4/4): correctly matches 401 and
  403 (confirmed against `lib/auth.ts` directly — `requireStudentMatching`
  returns 403 specifically for a mismatched student id, not just 401
  for no session at all), does not misfire on a genuine unrelated
  server error, and matches the fallback error-text case.
- All 15 other existing test suites still pass (104/104) — 108 tests
  total in the app now.
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** client bundle: confirmed the new,
  specific "was NOT saved and will NOT reach the Parent Portal" message
  is genuinely present in what ships.

## Honest scope note

This fix covers the RAG Classroom entry point specifically, since
that's what this question was about. The same underlying pattern
(client profile checked instead of the real session) likely exists on
other student-facing pages in this codebase that weren't part of
today's check — worth a broader pass if you want full coverage, but out
of scope for what was asked here.
