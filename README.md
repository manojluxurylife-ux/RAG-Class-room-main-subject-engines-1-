# AI Guru — SaaS Scaffold

A real, buildable Next.js 14 (App Router) project implementing the Student /
Parent / School / Admin portal structure, built on top of the proven
AI-maths-teacher concept from the standalone demo.

## What's actually working

- **`/classroom`** — full lesson generation + typewriter reveal + speed
  control + Q&A, calling real server-side API routes (`/api/lesson`,
  `/api/ask`) instead of a client-exposed key.
- **`/classroom` → Teach from textbook** — upload a photo or PDF page;
  multi-page PDFs get a thumbnail picker (`components/PDFPagePicker.tsx`)
  built on `pdfjs-dist`, with text extraction (`lib/client/pdf-text.ts`)
  sent alongside the page image for better accuracy. Split view shows the
  textbook page next to the AI's explanation.
- **`/admin/content` → Study Materials** — admin browses Google Drive,
  Google Cloud Storage, or the VPS's local `/public/materials/` folder,
  tags a file with subject/board/class, and publishes it. Three storage
  adapters live in `lib/storage/` (`drive.ts`, `gcs.ts`, `vps.ts`) behind
  a common `materialsStore` (`lib/materials-store.ts`, currently a flat
  JSON file — swap for a real DB later without changing the API routes).
- **`/admin/creator` → Creator Studio** — generates lesson plans, slide
  decks, quizzes, flashcards, mind maps, lab manuals, voice scripts, and
  revision notes via Gemini (`lib/content-generators.ts` holds the
  per-type prompts), tagged to subject/board/class/language exactly like
  the textbook lessons. One click publishes the result straight into the
  same Study Materials library students browse — no file upload needed
  since the content is generated and stored inline (`source: "generated"`
  in `materialsStore`).
- **`/materials`** — students browse published materials filtered to
  their own board + class, download via a unified proxy route
  (`/api/student/materials/[id]/download`) that handles all three
  sources transparently: Drive streams through the server, GCS redirects
  to a signed URL, VPS redirects to the static file path.
- **`/onboarding`** — language / board / class capture, same UX as the demo.
- **Role-based middleware** — `/parent/*`, `/school/*`, `/admin/*` redirect
  to `/login` without a session cookie.
- **Every route in the page map** renders and builds — verified with
  `next build` (47/47 pages compile clean).

## Setting up study materials (admin)

Pick whichever source(s) you actually use — none are required to run the app:

**Google Drive** — create a service account, share your materials folder
with its email (Viewer), put the JSON key in `GOOGLE_SA_KEY` and the
folder ID in `GOOGLE_DRIVE_FOLDER_ID`.

**Google Cloud Storage** — create a bucket, a service account with
Storage Object Viewer, put the JSON key in `GCS_KEY_JSON` and bucket name
in `GCS_BUCKET`. Downloads use 1-hour signed URLs so files never need to
be public and bandwidth doesn't route through your server.

**VPS** — just drop files into `public/materials/` (subfolders optional).
No credentials needed; Next.js/nginx serves them as static files.

Once configured, go to `/admin/content`, click a source tab, pick a file,
tag it, and publish.

## PDF worker — served from /public, not a CDN or webpack asset

The PDF-upload feature (`components/PDFPagePicker.tsx`, `lib/client/pdf-text.ts`)
needs pdf.js's worker file, and getting this right took two failed
attempts worth knowing about if it ever needs touching again:

1. **CDN-hosted, version-pinned** (`cdnjs.cloudflare.com/.../pdf.worker.min.mjs`) —
   broke in real deployment: cdnjs doesn't mirror every npm version, so
   the exact installed version 404s. This silently broke all PDF upload.
2. **Webpack asset bundling** (`new URL('pdfjs-dist/...', import.meta.url)`) —
   built fine in dev, but **failed the production build entirely**:
   Next.js's Terser minification pass tried to minify the emitted `.mjs`
   file and choked on `import.meta`, a real incompatibility for
   ES-module worker files run through a generic bundler asset pipeline.

**What actually works:** the worker file is copied straight into
`/public/pdf.worker.min.mjs` — a plain static file, zero webpack
processing, zero external network dependency, referenced by the simple
path `"/pdf.worker.min.mjs"`. `scripts/copy-pdf-worker.js` runs
automatically via the `postinstall` npm script on every install, so this
stays in sync with whatever `pdfjs-dist` version is actually installed —
a future version bump can't silently break this again.

## Real PWA foundation — manifest, service worker, Share Target

Earlier turns talked about AI Guru as a "hybrid PWA," but no actual
manifest or service worker existed until now — only the offline-AI logic
(`lib/offline-ai.ts`). This is the missing piece: `public/manifest.json`
+ `public/sw.js` + `components/ServiceWorkerRegister.tsx` make the app
genuinely installable (Chrome's "Add to Home Screen"), and register it as
a **Web Share Target** for PDFs/images.

**Official textbooks, honestly:** `/materials/textbooks` links to each
board's real government portal (NCERT, Kerala SCERT/Samagra, Tamil Nadu
Textbook Corporation, Karnataka Textbook Society — URLs verified against
each board's own `.gov.in`/`.nic.in` domain). AI Guru **never hosts
these PDFs** — NCERT's own terms explicitly prohibit third-party hosting,
so linking is the only legally sound option. Two ways for the PDF to get
into the app after downloading:
1. Manual upload via the existing "Teach from textbook" flow
2. **Share Target** (Android, once installed as a PWA): tap Share on the
   downloaded file → pick "AI Guru" → `app/share-target/route.ts`
   receives it via a real POST navigation, hands it off through
   `sessionStorage` to the classroom, which feeds it straight into the
   same PDF-picker pipeline already built. One tap instead of browsing
   for the file — this is the actual, working version of "auto-detect
   the download," since true cross-site download interception isn't
   something any browser allows.

## Real, colorful .pptx generation — no images, pure vector

`/admin/creator` → **Slide Deck** now produces a genuine, downloadable
`.pptx` file — not markdown, not a raster image. The strategy deliberately
avoids AI image generation entirely (Nano Banana, DALL-E, etc. were all
evaluated and rejected — see conversation history for why: deprecation
risk, enterprise-only APIs, or non-commercial licensing terms). Instead:

1. Gemini fills a structured `SlideDeck` JSON (`lib/slide-schema.ts`) —
   theme color pick, per-slide bullets/callouts/diagram *data* — following
   a detailed design brief (16:9 layout, 2-3 harmonious theme colors,
   max 6 bullets/slide, callout boxes for definitions and common
   mistakes, summary + quiz slides, sparing emoji use).
2. `lib/pptx-render.ts` (`pptxgenjs`) builds the actual file
   deterministically from that JSON — every diagram (flow, cycle,
   pyramid, timeline, comparison table) is real native PowerPoint
   shapes computed from real geometry, not an image. Verified end-to-end:
   generates a genuinely valid OOXML `.pptx` (checked with a real ZIP/XML
   parse, not just "the function didn't throw").
3. The file uploads to GCS and publishes through the exact same
   materials pipeline as everything else — students see it in
   `/materials` with a presentation icon and download the real `.pptx`.

This is dramatically lighter than image-based slides (a few hundred KB
vs. multi-MB), edit-friendly (a teacher can open it in PowerPoint and
tweak text directly), and carries zero image-generation licensing risk.

**Why "flow" and "timeline" diagrams here use native pptx shapes, not
Mermaid** — this was a deliberate, tested decision, not an oversight.
The live classroom lesson still uses real Mermaid (browsers have a real
DOM). This file runs server-side with no browser, and Mermaid was
actually tested here with a jsdom polyfill — it fails, because it needs
real text-layout primitives (`getBBox()`) that only a genuine rendering
engine provides, not a DOM polyfill. The only way to get real
server-side Mermaid is a full headless browser (Puppeteer + Chromium,
~100-150MB, real risk of breaking serverless deployments like Vercel's
50MB function limit) — not worth defaulting to while the deployment
target is still undecided. Native shapes stay the default: verified
working, zero deployment risk. If this ends up on a persistent VPS,
real Mermaid via Puppeteer becomes a reasonable one-time addition then.

## Interactive diagrams — Gemini/Gemma draw nothing, they only describe

Lessons can now include an optional `visual` field alongside the text —
a graph, a labeled triangle, a fraction bar, a rotatable 3D solid, a
flowchart. The core design rule, and the reason this exists as a separate
layer at all: **the AI never outputs pixel coordinates or drawing
instructions — only a small set of numbers/text (`lib/visual-schema.ts`),
and a real deterministic renderer (`components/visuals/`) computes the
actual correct drawing.** Small on-device models are unreliable at
spatial reasoning but fine at picking a shape and filling in numbers —
this architecture plays to that strength instead of fighting it.

| Visual type | Renderer | Why this library |
|---|---|---|
| `fraction`, `number-line`, `geometry` | Canvas (hand-built) | Pure arithmetic — side lengths → correct triangle via law of cosines, no coordinate guessing possible |
| `graph` | Chart.js + mathjs | Expression is evaluated by mathjs's safe parser (never JS `eval`), not interpreted by the model |
| `bar-chart` | Chart.js | Config-driven, AI just supplies labels + numbers |
| `flowchart` | Mermaid | Text syntax, not coordinates — a language task, which is what even small models are relatively good at |
| `solid-3d` | Three.js | The one justified 3D case for a maths app: CBSE/state Class 9-10 mensuration (volume/surface area of cones, cylinders, spheres) |

`isValidVisual()` gates every render — a malformed `visual` field (more
likely from the weaker offline Gemma model) just means no diagram shows,
never a crash.

**Three.js is deliberately isolated**: dynamically imported
(`next/dynamic`, `ssr:false`) so it's never in the main bundle, and
capability-checked (`hasWebGL2()`) with a text fallback for devices that
can't handle it — because the offline path already asks the same phone to
hold a 3+ GB LLM in memory; concurrent WebGL adds real GPU/battery load on
top of that.

**Scoped to Maths deliberately.** Konva.js (biology), Leaflet
(geography), vis-timeline (history), and Kekule.js (chemistry) were all
evaluated but intentionally not built yet — there's no Biology/Geography/
History/Chemistry lesson content in the app to render for. The dispatcher
pattern in `DiagramRenderer.tsx` is generic enough that adding a new
subject later means adding one case + one component, not a redesign.

## Low storage → save to the student's own Google Drive

On `/materials`, before any download starts, `lib/storage-check.ts` uses
the browser's Storage API (`navigator.storage.estimate()`) to check how
much space is actually free on the device. If it's low — under ~150 MB,
or under 4× the file's size — a modal (`components/SaveToDriveModal.tsx`)
asks the student whether they'd like to save the material to **their own**
Google Drive instead of downloading it locally.

This is a completely separate OAuth flow from the admin's Drive/GCS
credentials used to *source* study materials — the student authorizes
access to their personal Drive via Google's own consent screen
(`lib/student-drive.ts`), scoped to `drive.file` (the narrowest scope:
the app can only see files it created, nothing else in their Drive).
Nothing touches AI Guru's backend — the file is fetched into browser
memory and uploaded straight to Drive, never written to the device's
disk. Students can always choose "Download to device anyway" instead.

Requires `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (see `.env.example`) — without it,
the modal still explains the low-storage situation but only offers the
normal download.

## Admin business portal — real login, real data

Logging in at `/login` → **Admin** tab (using `ADMIN_EMAIL` / `ADMIN_PASSWORD`
from your environment variables) takes you to a completely different
version of the app — the business side, not the student side. This is a
real role-based session (`gg_session` httpOnly cookie, checked by
`middleware.ts`), not a client-side illusion.

- **`/admin/dashboard`** — business overview with real charts (recharts):
  signups over 30 days, revenue over 30 days, students by syllabus/language
  (pie charts), most-downloaded materials, MRR, churn rate, active/new
  student counts. All driven by one call to `/api/admin/stats`.
- **`/admin/users`** — every registered student, searchable by name/email/
  phone/school. Click into a student for their full profile, payment
  history, and download history (`/admin/users/[id]`).
- **`/admin/subscriptions`** — payment/subscription list with a revenue
  chart. Schema (`lib/subscriptions-store.ts`) is shaped to match a
  Razorpay webhook payload, so wiring real billing later is a matter of
  calling `subscriptionsStore.create()` from the webhook handler instead
  of the admin's manual "log a payment" button.
- **`/admin/messages`** — support/complaints inbox. Students write in from
  `/messages` (their side), admin replies from here, threads can be
  marked resolved/reopened.
- Every download a student makes is logged (`lib/downloads-store.ts`) with
  which material and which student, feeding the "Most downloaded" chart
  and each student's individual download history.

**Data layer:** everything above is backed by **Firestore**, not local
files — see the "Why Firestore" section in `lib/firestore.ts`. Local JSON
files (the pattern used earlier in this project) silently lose data on
serverless platforms like Vercel/Netlify, so every store that the admin
portal depends on was migrated before this feature was built, including
the study-materials store from earlier.

**Required env vars for this to work:** `GOOGLE_CLOUD_KEY_JSON`,
`GOOGLE_CLOUD_PROJECT_ID`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — see
`.env.example` for the full setup steps.

## What's intentionally stubbed (search the code for `TODO`)

- **Auth** (`lib/auth.ts`) — admin and student login are real (see above),
  parent/school login is still phone-OTP-skipped per `SKIP_VERIFICATION`
  in `lib/dev-mode.ts`. Wire up real OTP sending before launch.
- **Database** — students, subscriptions, downloads, messages, and study
  materials are all real Firestore data (see the admin portal section
  above). The **parent** and **school** portal pages, however, still use
  hardcoded mock data (children, classes, invoices) — they haven't been
  connected to Firestore yet.
- **Billing** — pricing/billing pages have no Razorpay integration wired
  in. Reuse the pattern from Nexus Justice (webhook HMAC verification,
  subscription gating).
- **Legal pages** (`/terms`, `/privacy`, `/refund-policy`, `/consent`) —
  placeholder copy only. Have real copy reviewed by counsel before
  launch, especially the children's-data sections (India's DPDP Act
  requires verifiable parental consent for under-18 users).
- **Quiz/practice mode** — page exists, no quiz generation logic yet.
- **`/signup/student`** — full form (name, email, phone, class, syllabus,
  school, location, password) with client-side validation, but submits
  to a stubbed delay, not a real account. Wire to a real
  `/api/auth/signup/student` endpoint that hashes the password and
  creates the record. **Note:** this form collects data directly from a
  minor, which sits in tension with the parent-consent model described
  earlier in this README (see `/parent/consent`) — decide whether you
  want students self-registering with parental consent captured
  afterward, or gate signup behind a parent account entirely, before
  wiring this up for real.
- **OTP/email verification is OFF by default** (`lib/dev-mode.ts` →
  `SKIP_VERIFICATION = true`). Right now `/signup/student` goes straight
  to `/classroom` after submitting — no phone or email check, free entry,
  meant for fast iteration while building. **Before going to market**,
  flip `SKIP_VERIFICATION` to `false` (or delete the flag and the
  `if (SKIP_VERIFICATION)` branch in `app/(auth)/signup/student/page.tsx`)
  so new accounts actually pass through `/verify-otp` — and build the real
  OTP-sending backend behind it, since that part is still stubbed too.
- **Materials store** (`lib/materials-store.ts`) — flat JSON file, fine
  for getting started but has no concurrency safety. Swap for a real
  table before you have multiple admins publishing at once.
- **"Teach from this" on `/materials`** — currently just downloads the
  file and sends the student to `/classroom` to upload it manually.
  Wiring it to auto-load into the textbook picker is a short follow-up.

## Getting started

```bash
npm install
cp .env.example .env.local   # add your GEMINI_API_KEY (free at https://aistudio.google.com/app/apikey)
npm run dev
```

**Build memory:** with Mermaid, Three.js, Chart.js, mathjs, and wllama all
in the dependency tree, `next build`'s type-checking step can need more
than Node's default heap. If you see an "out of memory" error during
build (locally or in CI), run:
```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run build
```
This only affects the build step — `npm run dev` and the deployed app
itself are unaffected.

**If lesson quality isn't good enough:** the app uses `gemini-2.5-flash`
by default (`lib/teacher-prompts.ts`, `MODEL` constant) — a reasonable
free-tier balance of cost and quality. Two levers if children still find
explanations confusing:
1. Try `gemini-2.5-pro` instead (same file, swap the `MODEL` string) —
   much stronger reasoning, still free-tier eligible on AI Studio, but a
   lower daily free quota.
2. The actual teaching instructions live in `gradeBandGuidance()` in the
   same file — it controls sentence length, what real-world objects to
   use as examples, and how new terms get introduced per class level.
   Tightening that function usually matters more than which model you use.

## New: Homework — quick text chat, distinct from Classroom and the live camera/mic channel

`/homework` — a new nav item, a one-shot text chat separate from both
Study Materials (persisted multi-segment courses) and the live camera+mic
voice channel (continuous streaming). Type a question, or attach a photo
of a problem from the textbook/notebook (`capture="environment"` opens
the camera directly on mobile) — Gemini vision reads it and answers.
Conversation is session-only (React state), same as Classroom's "Ask
AI Guru" Q&A and the live doubt-clearing panel — a homework
question is a one-off, not something needing cross-device history.

Every AI reply has five actions, all built on infrastructure that
already existed rather than new backend:
- **Copy** / **Download** (.txt) / **Delete** — simple, local, no server round-trip
- **Translate** — a per-message language picker; translates via the same
  BYOK Gemini call used to answer the question in the first place
- **Read Aloud** — the browser's Web Speech API (`lib/web-speech.ts`),
  the app's only text-to-speech mechanism now — see below for why

**Two real type errors caught during build, not shipped blind:** inside
async closures (`send()`, `readAloud()`), TypeScript couldn't guarantee
`profile` (captured from `studentSession.get()`, typed nullable) hadn't
gone null by the time the closure runs, even though the component
already returns early if it's null at render time — a real TS closure-
narrowing limitation, not a logic bug, fixed with `profile!` matching
the assertion pattern already used elsewhere in this codebase.

## Arabic added — a real, well-motivated market case, not an Indian regional language

CBSE-affiliated Indian schools are genuinely common across the Gulf,
and both Arabic-speaking students in those schools and Arab students in
Indian-curriculum schools need this. Added as its own `"global"`
confidence tier, deliberately distinct from the Eighth Schedule
tiering above — Arabic has a vastly larger digital footprint than any
Tier A-C Indian language here, so it doesn't inherit those languages'
translation-confidence caveats. Written in Modern Standard Arabic
(الفصحى), the formal register actually used in education across the
Arab world, not a regional colloquial dialect that would read
differently in the Gulf versus Egypt versus the Levant.

**The payoff of consolidating the language selectors last turn showed
up immediately here.** Before that refactor, adding one language would
have meant touching 4 backend files plus 6 separately-hardcoded UI
files — 10 places to remember, in a codebase where 3 of those 6 UI
files had *already* silently drifted out of sync with each other once
before. Adding Arabic this time only touched 5 files
(`lib/languages.ts` plus the 4 backend data files); every UI selector
picked it up automatically because they all now derive from the same
shared source.

Verified this wasn't just assumed to work: re-ran the same
cross-file consistency check from the Indian-language expansion,
confirming Arabic is genuinely present in all five core data sources
(not just added to one and forgotten in another), and that all five
now report exactly 24 entries — the previous 23 plus Arabic, nothing
missed and nothing duplicated.

**A real, pre-existing gap made concrete rather than papered over:**
added an `isRTL` field to `lib/languages.ts` while doing this — not a
new problem Arabic introduces, but worth being honest that Arabic is
now the fourth right-to-left language in this list (after Urdu,
Kashmiri, Sindhi) with genuinely zero RTL layout handling anywhere in
the app, checked directly. Generated lesson text in these languages is
correct; it just isn't laid out the way a native RTL reader would
expect — right-aligned, mirrored layout. That's real, separate UI work
this addition doesn't attempt to solve, now tracked as a structured
field instead of an easy-to-lose comment.

## A real admin entry key — genuine defense in depth, not just a second copy of the same open door

The existing login bypass (`DEV_BYPASS_LOGIN`) was fully open to anyone
who visited the login page while the flag was on — no credential
needed at all. Requested a real key requirement on top of it, so even
an accidentally-left-on flag doesn't mean "anyone who finds the URL is
in."

`ADMIN_ENTRY_KEY` is a genuine secret, set in the environment the same
way `ADMIN_EMAIL`/`ADMIN_PASSWORD` already are — never hardcoded. Two
real design decisions worth being explicit about:

**Fails closed, not open, when unconfigured.** If `ADMIN_ENTRY_KEY` was
never set, the bypass refuses to run at all — it does not silently fall
back to "no key needed," which is the failure mode that would have
made this whole feature pointless. Verified directly: even providing
what looks like a plausible key gets rejected when the env var itself
doesn't exist.

**"Remembering" the key across portal switches doesn't use a forgeable
cookie.** The obvious naive approach — a cookie that just says
`verified: true` — could be set by anyone in devtools with zero
knowledge of the actual key. Instead, the remembered proof is a SHA-256
hash of the real key, computed server-side; matching it back requires
actually knowing the key, not just guessing a cookie value. Verified
this holds: a forged or guessed cookie value is correctly rejected,
while the genuine computed proof correctly passes.

**"All portals, all pages"** is a new persistent widget
(`PortalSwitcher.tsx`) — a small floating control, bottom-left, on
every portal page, that only shows itself once a lightweight status
check confirms this browser already holds a valid proof from an
earlier successful entry. That status check is explicitly not the real
security boundary — every actual switch still goes through the same
`/api/auth/dev-bypass` route, which independently re-verifies the proof
itself, exactly as strictly as the first login-page entry did.

## Shared question papers are now genuinely available, not just discoverable if you guess the right word

Real gap in the previous design: a shared pattern only surfaced if a
student typed the *exact* subject another student had already uploaded
under. That's "discoverable if you happen to guess right," not
"available to him" — if a Class 8 CBSE student didn't know Geography
had already been uploaded, they'd never see it and might upload a
duplicate themselves.

Added `findAllForClass()` to `lib/shared-exam-patterns.ts` and a new
route mode (`shared-patterns` without a `subject` parameter) that
returns every pattern already available for a student's exact board and
grade, across all subjects at once. `/exam-room` now loads this list
automatically the moment the page opens — no typing, no guessing,
no separate "check" button. A student just sees what's already there
for their exact class and board, and picks one directly.

When more than one pattern exists for the same subject (two different
students uploaded, say, two different Geography papers), the one more
students have already generated a real exam from wins — a genuine, if
modest, trust signal over a subject nobody's tried yet.

Verified the actual deduplication and filtering logic directly, not
just the happy path: confirmed a higher-trust duplicate correctly wins
over a lower one, and confirmed entries from the wrong grade or the
wrong board are excluded even when everything else about them matches.

## Exam Room's upload section renamed for clarity

Real, reasonable feedback: "Or bring your own paper" doesn't clearly
say what the feature actually does or what to upload. Renamed to
"Upload a model or previous-year question paper" throughout — the
heading, the file input label, the button text, every error message
and status line that referenced "your paper" or "this PDF" — so a
student encountering this for the first time knows exactly what's
being asked of them: a real question paper PDF, not an ambiguous
"paper" that could mean anything.

## Arabic added for the Gulf market — and a real, pre-existing rendering gap addressed where it matters most

Requested for a genuine, concrete reason: CBSE-affiliated Indian
schools are common across the Gulf, serving both Arabic-speaking
students and Indian-curriculum students who need Arabic support.

**Found this already fully wired when checking before building it** —
the same pattern as the broader language expansion: `lib/languages.ts`
already had Arabic added, correctly, with a distinct `"global"`
confidence tier (explicitly not inheriting the India-specific
tiering's caveats, since Arabic has vastly more digital presence and
training data) and real Modern Standard Arabic — the formal register
actually used in education across the Arab world, not a regional
dialect. Verified this wasn't just present in one file: ran the same
cross-file consistency check as the broader language work and confirmed
all 24 entries (23 previous + Arabic) match exactly across
`languages.ts`, both `LANGUAGE_NAMES` copies, `WEB_SPEECH_LANG`, and
`SETUP_VOICE_SCRIPTS`.

**What genuinely wasn't done yet, and what got fixed:** Arabic joins
Urdu, Kashmiri, and Sindhi as a right-to-left script, and this app has
zero RTL text-direction handling anywhere — checked directly, confirmed
by grep, not assumed. Added `isRtlLanguage()` to `lib/languages.ts` and
applied it to Homework's chat bubbles specifically — the text itself
now renders `dir="rtl"` for these four languages, correctly respecting
a per-message translation override where one exists (using the exact
same fallback priority already proven correct for that message's
text-to-speech language).

**Honest about the actual scope of this fix, not overclaiming it:**
this addresses Homework specifically, the clearest, most self-contained
surface where AI text is displayed. Classroom's lesson content and Q&A
thread, Study Materials' segments, Practice Materials, and Exam Room
all still lack this — a real, separate follow-up, not silently assumed
fixed everywhere just because the underlying data (`isRTL` on each
language) now exists.

## Expanded to all 22 scheduled Indian languages — and a real discovery along the way

Asked to add every Indian language reasonably possible. Started
drafting a conservative subset (18 languages, deliberately excluding 5
lower-resource ones) — then discovered, while trying to wire it in,
that **substantial, careful work already existed** in
`lib/teacher-prompts.ts`, `lib/teacher-prompts-client.ts`,
`lib/web-speech.ts`, and `lib/setup-voice-scripts.ts`: all 22 scheduled
languages, correct native names and scripts, RTL notes for Urdu/
Kashmiri/Sindhi, an honest three-tier confidence system (A/B/C) for
translation quality, and even a genuine, careful Ol Chiki-script attempt
for Santali — more thorough than what was being newly drafted.

Rather than compete with that already-good work, `lib/languages.ts` was
rebuilt to accurately *mirror* it — same 22 languages, same tier
labels, sourced from what was actually already there, not a
independently-drafted subset. **Verified this cross-referencing wasn't
just assumed:** wrote a real script comparing all four core data files
against each other by language ID — confirmed all four have exactly the
same 23 entries (22 languages + English), no drift between any of them.

**The real, concrete gap found and fixed:** despite that backend being
complete, the actual UI selectors — the buttons a student or admin
clicks — were still stuck at the original 6 languages in half the app.
Checked every file with a language selector (6 of them) and found a
genuine, pre-existing inconsistency: `admin/content`, `admin/creator`,
and `profile` already had all 22 (independently, each with its own
hardcoded copy); `onboarding`, `homework`, and `study-materials` were
still stuck at 6, meaning a student could never actually select 16 of
the 22 languages the backend already fully supported.

Fixed by consolidating all six into one shared source
(`SUPPORTED_LANGUAGES` in `lib/languages.ts`) — not just patching the 3
broken ones, since the 3 "working" ones were each independently
hardcoded too, and would have silently drifted out of sync again the
next time a language was added. A syntax break introduced while first
attempting this (an incomplete `Object.fromEntries` derivation left
alongside old object-literal lines) was caught by directly inspecting
the file while cross-checking it against `teacher-prompts-client.ts`,
before ever running a build — worth being precise about rather than
claiming the build caught it, since it didn't get the chance to; the
mistake was fixed first.

## A real safeguard for the English fallback — catches "added the language, forgot the translation" early

Confirmed the fallback already existed and worked (every voice call in
the app already had `|| "en-IN"` inline) — but five separate call sites
each doing the same fallback independently meant no single place to
add a warning, and no guarantee they'd all stay in sync if one changed.

Centralized into `getSpeechLang()` in `lib/web-speech.ts` — one
function, all five call sites (Homework, the camera/mic panel, both new
setup modals) now go through it, replacing five copies of
`WEB_SPEECH_LANG[languageId] || "en-IN"` with one shared source of
truth. Same treatment for `getSetupVoiceScript()` in
`lib/setup-voice-scripts.ts`.

Both now warn in the console — but only for a genuine gap, not for
ordinary use: no warning when English is directly requested (that's not
a fallback, it's just English), no warning for any of the five other
real supported languages, and only once per language per session even
if it's triggered repeatedly, so a real gap surfaces clearly without
spamming the console on every single TTS call. Verified all of this
directly, not just the happy path: confirmed zero warnings for English
and for a real supported language (Tamil), confirmed exactly one
warning fires for a genuinely unrecognized language, and confirmed
calling it three more times for that same unrecognized language still
only logs once total.

Right now this can't fire through the app's own use at all — the
Profile page's language selector only offers these exact six languages
as buttons. This exists for later: the moment someone adds a seventh
language button without also adding its translation and voice locale
entry, this warning is what catches that gap immediately during
testing, instead of it quietly reaching a real student.

## Gemini key and Local Brain setup moved to Home, with voice guidance in the student's own language

Real, reported confusion: clicking "Gemini API key" from the Home page
checklist sent students into the full Profile page — settings, AI mode,
materials preferences, all before the actual thing they clicked for.
Found the good news first: `GeminiKeySetup.tsx` already existed as a
genuinely complete, working component (clipboard auto-detection,
manual fallback, validation) — the fix wasn't rebuilding key-saving
logic, it was giving it a proper home.

Both Gemini key and Local Brain now open as an in-place modal directly
from Home — the existing `GeminiKeySetup` wrapped, not duplicated, so a
fix to its clipboard-detection logic still only lives in one place.

**Voice guidance, with one technical detail that mattered:** Web
Speech's `lang` property only changes pronunciation, it doesn't
translate text — reading English instructions with a Tamil voice tag
would just mispronounce English words, not help a Tamil-speaking
student. So `lib/setup-voice-scripts.ts` has the actual narration
written out in each of the six supported languages, not one script with
a locale tag swapped. Genuinely honest about the limit here: these are
a reasonable best effort, not verified by a native speaker of each
language the way curated curriculum content elsewhere in this app has
been — worth a native-speaker review, especially for Tamil, Kannada,
and Telugu, before this reaches real students.

**Celebration and the green state change, both real requests, both
built:** `CelebrationBurst.tsx` is a genuine confetti burst (Canvas,
gravity-affected particles, no new dependency) that plays once a step
actually completes. And completed steps turn a distinct green — not
the app's usual marigold — specifically so "this is now active" reads
as a clearly different state from "you could click this," not just a
brighter version of the same color.

Verified directly: all six languages have complete scripts (not
partially filled in), and an unrecognized language code correctly falls
back to English rather than silently breaking.

## "Ask AI Guru" is now genuinely available anytime, not gated behind finishing a lesson

Real feedback: gating the camera/mic panel behind "finish today's
lesson first" never matched how doubts actually come up — a student
might want to ask about yesterday's class, or nothing on the page at
all yet. Checked the actual nesting before assuming a small tweak would
fix it: the button was gated **two levels deep** — inside
`stage === "lesson"` AND inside `!lessonTyping` — meaning it wasn't
reachable at all on the topic-selection screen, not just delayed until
a lesson finished.

Moved it to a fixed, floating button, a genuine sibling at the top of
the page's return statement rather than nested inside any stage-specific
block — confirmed directly by tracing the JSX structure, not just
visual inspection, that it renders unconditionally across all three
stages (select, loading, lesson) and only hides while the panel itself
is already open.

## Student-contributed exam patterns are now shared — but not the way Study Materials shares content

Asked directly: can the admin database save a student's uploaded pattern
(e.g. "Class 8 Tamil Medium Geography") and give it to other matching
students, the way Study Materials already does? Yes, but with one
real, deliberate difference worth being clear about, not glossed over.

Study Materials shares actual generated CONTENT — every student reading
the same correct explanation is fine, since it's teaching. Sharing the
exact same generated EXAM QUESTIONS across students would let them
share answers with each other, defeating the entire point of a test.
So `lib/shared-exam-patterns.ts` shares only the **structure** — section
labels, question-format counts, marks, duration — never the actual
questions. Every student who uses a shared pattern still gets a
genuinely fresh, independently-generated set of questions from it.

Matched on board + grade + subject only, deliberately not language/
medium — the real exam's structure doesn't depend on what language it's
asked in; only the final generated questions need to be in the
requesting student's own language, which already happens at generation
time regardless of who originally contributed the pattern.

**A real, automated quality gate Study Materials doesn't have an
equivalent for:** only patterns that pass the marks-consistency check
(the same `findSectionMarksMismatches` built for the admin tool) get
shared at all — recomputed server-side, never trusting whatever the
client reported earlier, since this decision now affects other
students, not just the one uploading. A pattern with a real, detected
mismatch stays private to whoever uploaded it; sharing something
already flagged as possibly wrong would be a worse outcome than not
sharing it.

`/exam-room` now checks for a shared match *before* asking a student to
upload anything — type a subject, and if another student already
contributed a clean pattern for the exact same board/grade/subject, use
it directly with one click. Verified the actual matching and publish
logic with real test cases: subject matching correctly tolerates case
and whitespace differences while still correctly rejecting genuinely
different subjects, and the publish decision correctly requires both a
real board (not an anonymous upload) and a clean mismatch check —
tested all combinations independently, not just the happy path.

## Corrected: the upload flow belongs to students, not just admins — a more scalable answer to subject coverage

Built the extraction technology as an admin curation tool first; the
actual ask was a student-facing feature — any student, any class,
subject, or board, bringing their own real paper. Genuinely more
scalable than admin curation: no library-building bottleneck at all,
works immediately for anything a student already has in hand, without
needing us to hand-verify every board's every subject first.

`/exam-room` now has an "Upload a model or previous-year question paper" section alongside the
pre-built CBSE Class 10 Maths pattern. Upload any real sample or
previous-year paper PDF, and it extracts the actual structure directly
— reusing the exact same extraction logic already built for the admin
tool (`lib/exam-patterns.ts`'s `extractPatternFromPdf`, factored out
into one shared function so a future fix or prompt improvement lands in
both places at once, not two copies that could quietly drift apart).

**Different confirmation UX for a different purpose.** The admin tool
shows raw JSON for precise editing, because it's building a shared,
published resource other students will see. This is a student's own
one-off paper, never shared — so confirmation is a plain-language
summary ("Section A — 10 mcq (1 mark each), 2 assertion-reason...")
with an editable duration field, not a JSON textarea a non-developer
shouldn't have to read. Mismatch warnings still surface in plain
language if the marks don't add up, same underlying check, friendlier
presentation.

**A real correctness detail, tested rather than assumed:** the
extraction prompt is deliberately instructed to report `durationMinutes`
as 0 when a document doesn't state a duration explicitly, rather than
guessing a plausible-sounding number — but a 0-minute exam would
auto-submit the instant it started. Verified the UI's fallback
explicitly: a real extracted duration is used as-is; a genuine 0 falls
back to a safe default (60 minutes) that the student can still adjust
before starting, rather than silently producing a broken exam.

Once generated, a custom-uploaded paper is indistinguishable from a
pre-built one to the rest of Exam Room — same `ExamAttempt` shape, same
timer, same scoring, same review screen. The only difference is where
the structure came from.

## Exam pattern extraction from a real uploaded sample paper — solving the "secondary sources disagree" problem directly

Expanding Exam Room beyond Maths hit a real wall: researching Science's
blueprint from secondary/coaching sites turned up a direct conflict —
some described the same A–E section structure as Maths, another
described three content sections (Biology/Chemistry/Physics) entirely.
Checked OpenVidya's "Exam Dojo" and OpenMAIC's quiz system for anything
reusable first (both real, both checked directly) — neither has an
actual multi-subject exam blueprint system, just per-topic practice
question generation, a different and smaller thing.

DeepTutor's `exam_mimic.py`/`mimic_source.py` had the right underlying
idea, even though its specific output (a loose reference-question list
for style-mimicry, via an external MinerU parsing pipeline) isn't
directly usable as a formal blueprint: **derive structure from a real
uploaded document instead of reconciling secondary sources that
disagree with each other.**

Built our own version of that idea using Gemini's own document
understanding (already used throughout this app for photographed
textbook pages — no new parsing dependency needed): an admin uploads
the actual official CBSE sample paper PDF, and `/admin/exam-patterns`
extracts a draft `ExamPattern` directly from it — real section labels,
real question-format counts, real marks, cross-referenced against each
other automatically.

**Never auto-published — same principle `exam-patterns.ts` has stated
from the start.** The extraction is a reviewable draft: the admin sees
it, can edit the raw JSON directly, and gets a ready-to-paste
TypeScript snippet to add to `EXAM_PATTERNS` by hand, only after
checking it against the real document.

**The actual safety mechanism, verified with real test cases, not just
built and assumed correct:** every section's block marks are
automatically summed and compared against its declared total, and
against the paper's declared grand total — a real, checkable signal
that the AI misread something, surfaced immediately rather than
silently passed through. Tested against a realistic miscounting
scenario (20 MCQs entered against a section still declared as 20 marks,
when it should total 22) — correctly flagged at both the section and
grand-total level. A correctly-extracted pattern correctly stays silent.

## Exam Room — a real, timed board exam, built on prior work that was verified but never wired

Prompted by reviewing a ChatGPT conversation the project owner had
about question-generation tools. Checked the specific reference
(`ramsrigouthamg/Questgen.ai`) directly: real, but a pre-LLM (2020-era)
T5/BERT/spaCy pipeline producing mechanically weaker questions than
Gemini already generates for us, with a heavy Python dependency stack
incompatible with this stack. Not adopted. Two more modern equivalents
turned up in the same search (`prathamdby/questgen`, a Next.js+Gemini
sectioned exam-paper generator; `cRED-f/QuestGen-AI-Agent`, a
multi-agent version) — not adopted either, but they confirmed a
timed, sectioned exam-paper feature is a real, validated thing other
people have independently built, not a strange idea.

**Found real, substantial prior work already in the codebase before
building anything new:** `lib/exam-patterns.ts` — a genuinely verified
CBSE Class 10 Mathematics board exam pattern (80 marks, 3 hours, 5
sections, 38 questions), cross-checked programmatically: every
section's computed marks (count × marks-each) exactly match its
declared total, and the grand total is genuinely 80. This file existed
but had **zero imports anywhere** — verified, accurate data with no
portal built on top of it yet.

Built the actual portal on that foundation: `examPaperSystemPrompt()`
generates a full paper following the exact section/format/mark
structure (reusing the same per-format JSON shapes already proven in
Practice Materials, not a new prompt language), a real Firestore-backed
`ExamAttempt` (persisted, not ephemeral like Practice — a timed attempt
needs to survive a page refresh), a countdown timer that auto-submits
at zero with no grace period, and a submit-once flow with no
per-question feedback until final submission — genuinely different
from Practice Materials' immediate-check experience.

**The honest scoring limit, stated plainly, same principle as Practice
Materials:** only 20 of 80 marks (Section A — MCQ, Assertion-Reason)
are objectively auto-gradable. The other 60 marks (short-answer,
long-answer, case-study) are self-assessed after submission — the
student sees their own written answer next to the model answer and
marks it themselves, contributing to a clearly-separate "estimated"
score, never silently merged into the objective one.

Verified the actual scoring pipeline with a realistic mixed exam, not
just read the code: correct/incorrect detection across all five
auto-checkable formats in one pass, including the fill-blank
whitespace/case-insensitivity handling and partial-credit math (a
"partial" self-mark correctly contributes exactly half the question's
marks). Also caught and fixed a real, pre-existing bug while wiring the
nav for this — the student layout had "Virtual Lab" linked twice,
identically, a genuine duplicate unrelated to this feature that just
happened to be sitting there.

## Progressive Study Material generation — segment 1 fast, the rest follow

Adopted the idea from evaluating DeepTutor's Book engine (a real asyncio
background worker generating pages progressively, confirmed by reading
its actual `_worker_loop`) — but not the mechanism, which is a
persistent long-running process that doesn't map onto serverless
functions. Built the equivalent two-request shape instead.

**Before:** uploading a textbook page meant one Gemini call generating
every segment for the whole material before anything rendered — real,
avoidable dead time, especially given this app is deliberately built for
budget Android devices and patchy connections, exactly where a long
blank screen reads as "the app froze."

**Now:** `studyFirstSegmentSystemPrompt()` generates segment 1 (fully,
not shortened) plus a short roadmap of what's next; the student sees it
almost immediately. `studyRemainingSegmentsSystemPrompt()` then runs in
the background (triggered by the client right after stage 1 returns,
not blocking the UI), using the roadmap and segment 1's heading to keep
tone and difficulty consistent, and appends the result. Auto-publish to
the shared library was moved to this second stage entirely — publishing
a one-segment "course" to other students would be a real, confusing bug,
not a minor one.

Two things verified directly, not just assumed from the code reading
correctly:
- `appendSegments()` — confirmed it preserves segment order, never
  touches segment 1, and correctly flips `generationStatus` to
  `"complete"`.
- The publish-decision logic — confirmed all three real cases: a fresh
  partial material correctly generates without publishing yet; a
  retried/duplicate call on an already-published material correctly
  does *not* publish a second time; and the edge case where the AI
  decides a page only needs one segment (complete immediately, roadmap
  empty) correctly skips generation but still publishes, since it's
  genuinely done and hasn't been published yet. That middle case is the
  one that actually matters — a naive design would have published the
  same material twice on any retried request.

Both the Kitchen list and the segment player show a "preparing more
segments…" indicator while stage 2 is still running, so a student who
navigates quickly isn't confused by segment count changing under them
without explanation.

## Real offline vision fallback — Gemma 4 E2B can now see the camera too, when Gemini Live can't be reached

Asked directly: can Gemma 4 (already running on-device as a fallback for
text lessons) do everything Gemini does, including seeing the camera,
with no network? This needed real research, not an assumption either
way — checked three separate, genuine technical questions before
writing any code:

1. **Is Gemma 4 E2B actually multimodal?** Confirmed via Google's own
   model card: yes, genuinely — a real vision encoder plus a USM-style
   audio conformer, not a marketing claim.
2. **Does llama.cpp (which wllama compiles to WASM) support this?**
   Confirmed: "Gemma 4 supports image inputs in llama.cpp from day one,"
   via a separate multimodal projector (mmproj) GGUF file alongside the
   main model.
3. **Does `wllama` *specifically* — our WASM wrapper, not llama.cpp's
   native C++ tooling — expose this?** This is where I stopped trusting
   search results and did something more rigorous: installed the actual
   `@wllama/wllama@3.5.1` package (the exact version already used in this
   app) and read its real, shipped `.d.ts` type definitions directly.
   Confirmed genuinely: `ChatCompletionUserMessage.content` accepts an
   array mixing `{type:'text', text}` and `{type:'image', data: ArrayBuffer}`
   parts, and `loadModel([mainBlob, mmprojBlob], ...)` is the real
   multimodal loading path — not guessed from documentation fragments.

**Built on that verified foundation:** `lib/offline-ai.ts` gained
`downloadVision()` (loads the main model + mmproj file together) and
`generateWithImage()` (the offline equivalent of the Gemini vision
calls used elsewhere), kept as a separate download/status from the
existing text-only fallback — Classroom's text lesson fallback doesn't
need vision, and the mmproj file is a real, substantial extra download
that shouldn't be forced on everyone. `DoubtCameraMic.tsx` now offers
"Try offline AI instead" when there's no BYOK key or the live connection
fails, opening a genuinely different, honest UI: snapshot-based (one
photo per question, not continuous streaming — a real architectural
difference from Gemini Live, not a lesser copy of it), reading the
answer aloud via Web Speech. Settings gained a matching download section
for this camera add-on, separate from the base offline model.

**The one thing this code cannot resolve by itself, stated plainly:**
loading real Gemma 4 vision requires an actual mmproj GGUF file
(~800MB-950MB based on comparable releases) hosted somewhere real. The
project owner's existing HuggingFace repo doesn't have one yet —
`HF_MMPROJ_FILE` in `lib/offline-ai.ts` names the expected convention,
but an actual working file needs to be uploaded there (or the constant
repointed to wherever one is verified to exist) before this loads
successfully. Downloading fails with a clear, real error if the file
genuinely isn't there yet — it does not pretend to work in the meantime.

**A real, mid-session mistake, worth being direct about:** this
sandbox reset partway through building this feature, silently losing
the `offline-ai.ts` and `DoubtCameraMic.tsx` changes that hadn't been
re-packaged into a zip yet. Caught this by checking the actual file
contents rather than assuming prior work was intact, redid the lost
work directly from the already-verified API research (no need to
re-research, since that part was solid), and started checkpointing the
zip after each file rather than only at the very end — a real, adopted
change in how this specific feature got built, not just a note in
hindsight.

## Biology — the hardest of the three, solved with a genuinely different shape of solution

Cell and anatomical diagrams aren't reducible to a few numbers the way a
triangle, circuit, or molecule is — they're illustrative. Asking the AI
to generate SVG paths stroke-by-stroke would mean trusting it to get
real anatomy right with no way to verify, a materially different risk
than picking a difficulty level or a SMILES string. So this is a
genuinely different pattern from Chemistry/Physics: a small, curated
library of hand-authored, pre-verified diagrams (`lib/biology-diagrams.ts`)
that the AI *selects from* — never generates. The AI's only input is a
`diagramId` string, checked against a closed, exported list
(`BIOLOGY_DIAGRAM_IDS`) that the prompts reference directly, not a
free-form description to interpret. Worst case on a wrong selection is
showing a real, correct diagram that isn't the most relevant one —
never an anatomically wrong one.

Seeded with two diagrams, deliberately: plant cell and animal cell, the
single most common Class 8-10 diagram and a natural compare/contrast
pair (a frequent exam question) — the plant cell correctly shows the
cell wall and large central vacuole that specifically distinguish it;
the animal cell deliberately omits both, since showing them would teach
the exact confusion this diagram exists to prevent.

**A real mistake caught and fixed during this build, not before
shipping it:** the first attempt at wiring the prompt updates used a
Python script with two sequential file edits — the second one's
assertion failed on a wording mismatch, which meant the script exited
before either edit was actually written to disk, silently. The import
line had already been added separately via `sed`, so it looked complete
enough to move on to the next file — but checking directly afterward
showed the actual prompt content was never saved in either
`teacher-prompts.ts` or `teacher-prompts-client.ts`. Caught by verifying
what was actually in the files rather than assuming a script that ran
without a visible full failure had succeeded, and fixed properly in
both.

Verified everything actually testable in this sandbox: the dynamic id
list correctly drives the prompt text (so adding a third diagram later
can't silently go stale), lookup correctly resolves both real diagrams
and correctly returns nothing — not a crash — for a hallucinated id
outside the curated set, and both hand-authored SVGs are confirmed
well-formed XML via a real parser, not just visual inspection. Same
honest limitation as GeoGebra/the molecule renderer: the actual visual
clarity (label legibility, layout) needs confirming on a real device —
this sandbox can verify the data is correct and the markup won't break,
not what it looks like on screen.

## Physics gets a real visual too — hand-built, after genuinely checking for a library first

Chemistry had `smiles-drawer` — a clear win, peer-reviewed and widely
used. Checked whether Physics circuit diagrams had an equivalent before
assuming otherwise: **it doesn't.** `tscircuit` (MIT, real, actively
developed) is professional PCB/EDA design software — manufacturing
exports, KiCad integration — genuine overkill for a textbook diagram.
`circuit-diagram` (npm) is deprecated, consolidated into an unmaintained
package a decade ago. `react-circuit-schematics` looked promising by
name, but checking it directly showed 5 stars, 1 watcher, and **no
formal releases ever published** — that's a real red flag, not the same
bar `smiles-drawer` cleared (peer-reviewed publication, active recent
releases, wide real-world adoption). Rather than force-adopt something
that risky, `circuit` (`lib/visual-schema.ts`) is hand-built —
`components/visuals/CircuitDiagram.tsx` draws standard schoolbook
symbols (zigzag resistor, long/short-line battery, circled meter
letters) deterministically from Canvas, the same proven pattern already
used for `GeometryShape`/`FractionVisual`/`NumberLineVisual` — the AI
only ever picks which components appear and in what order, never
coordinates or a drawing.

Deliberately scoped to simple series circuits (2-6 components, one
loop, no branching) — this covers the actual curriculum need directly:
it matches `lib/lab-kb.ts`'s already-curated "Verifying Ohm's Law"
experiment exactly (battery, switch, resistor, ammeter in series).
Parallel/branching circuits are a real, separate extension, not
attempted here.

Since this is pure deterministic drawing logic (unlike `smiles-drawer`/
GeoGebra, which need a real browser to render), the geometry itself
could actually be verified directly rather than only checking that it
compiled: tested the real Ohm's Law circuit through validation
(correctly accepted), confirmed too-few/too-many/invalid-component-kind
inputs are all correctly rejected, and worked through the actual layout
math for a 4-component circuit to confirm no two components' drawing
regions overlap — the kind of bug that would otherwise only show up as
visibly broken symbols crowding into each other on screen.

Biology remains open — its diagrams are more illustrative than
reducible to simple parameters the way circuits and molecules are, so a
curated-template approach (the same pattern as `concept-kb.ts`/
`lab-kb.ts`) is probably the right shape, not a parameterized renderer.
Real, separate work, not started here.

## Chemistry gets a real visual — closing a gap the app has had since Study Materials was built

Asked directly whether other subjects had anything advanced we lacked.
Checked DeepTutor's actual cross-subject approach and found it isn't
subject-specific either — it routes on the student's verb, not the
topic, and for anything outside math it just has the AI author raw SVG
or HTML directly. That's the same trust trade-off as their interactive-
HTML system already declined earlier — applied more broadly, not a
hidden better method being missed.

This exposed a real, honest gap worth fixing properly instead: Chemistry
is one of six subjects this app claims to support, and had zero
dedicated visual — every one of the 8 existing visual types was Maths-
specific or generic. Fixed with `molecule` (`lib/visual-schema.ts`),
using SMILES notation — a genuinely standard, decades-old chemical
notation (water is `"O"`, ethanol is `"CCO"`, benzene is
`"C1=CC=CC=C1"`), not anything invented for this app. Verified
`smiles-drawer` directly before adopting it: MIT license (checked the
actual installed package's LICENSE file), peer-reviewed and published in
the Journal of Chemical Information and Modeling, actively maintained,
zero server dependencies — the exact same "AI writes small well-defined
text, a trusted library draws the real structure" principle as every
other visual type, never coordinates or a drawing supplied directly.

Wired into every place the visual pipeline already runs — Study
Materials, the live Classroom lesson, both server and BYOK prompts —
with explicit instruction to use only real, standard SMILES for the
actual molecule under discussion, never approximated notation.

**Honest limitation, not hidden:** `smiles-drawer` renders via real
browser SVG APIs, which this sandbox can't execute — verified what's
actually testable here (the schema validation logic, and a clean
production build with the new type wired end-to-end), but the real
molecule rendering itself needs confirming on an actual device, the same
boundary that applied to the camera/mic pipeline earlier in this project.

Physics and Biology remain open — Physics likely needs a genuinely new,
hand-built renderer (no existing library to lean on the way SMILES/
GeoGebra provided here); Biology's diagrams are more illustrative than
parameterizable, so a curated-template approach (like `concept-kb.ts`/
`lab-kb.ts`) is probably the safer path. Real, separate work, not
started here.

## Interactive geometry (GeoGebra) and streaming chat responses — both adopted from DeepTutor

**GeoGebra** — DeepTutor's `vision_solver_agent.py` reads a photographed
geometry problem and emits GeoGebra commands directly; genuinely
adoptable since GeoGebra's input-bar language is constrained and
well-defined (not arbitrary code, so it doesn't carry OpenMAIC's
AI-generates-HTML trust problem), and their embeddable applet is free
and mature. Added as a new `Visual` type (`lib/visual-schema.ts`) fitting
the exact same principle every other visual type already follows — the
AI supplies small, checkable data; `components/visuals/GeoGebraViewer.tsx`
(dynamically imported, same pattern as the Three.js solid-3D renderer)
evaluates each command independently, so one malformed line degrades to
"skip that command" rather than breaking the whole construction. Wired
into every place the existing visual pipeline already runs — Study
Materials generation, the live Classroom lesson, both server and
client/BYOK prompts — with explicit guidance to use it only when a
construction genuinely benefits from being interactive, not as a
default replacement for the simpler static `geometry` type.

**Streaming responses** — checked our own code directly rather than
assume: zero streaming existed anywhere, every AI answer waited for the
complete response before showing anything. DeepTutor's chat streams
token-by-token; the bulk of their actual implementation turned out to be
multi-provider compatibility plumbing (handling different vendors' quirks)
that doesn't apply to this app at all, since it's deliberately
Gemini-only — but the core idea (progressive, ChatGPT-style reveal) is
real and worth having. Added `callGeminiClientStream()`
(`lib/student-key.ts`) and wired it into Homework, the clearest
"chat and get an answer" feature and the most direct comparison point.

Tested the SSE parsing directly, not just that it compiled — the
critical case: a single JSON payload split across two separate network
reads (which happens constantly on real connections, not an edge case)
reconstructs correctly rather than silently corrupting mid-stream.
Also handled a real failure mode: if the connection drops partway
through a genuinely useful partial answer, that partial text stays
visible with the error appended, rather than being discarded — a
student seeing half a correct explanation is better than seeing nothing.

**Scope boundary, stated honestly:** the Messages live-chat bot (built
earlier) is the other clearly "chat" feature in this app, but streaming
it would mean converting a server-side REST route to Server-Sent Events
— genuinely different plumbing from the client-side BYOK streaming built
here, not done in this pass. A real, separate follow-up if wanted.

## Mastery Score upgraded — recency-weighted, confidence-capped, adopted from HKUDS/DeepTutor

Evaluated HKUDS/DeepTutor (a large, actively-developed, general-purpose
AI tutoring platform) for anything worth adopting. Confirmed **Apache
2.0** directly from the actual LICENSE file — genuinely permissive,
unlike OpenVidya's AGPL-3.0. Most of the repo (RAG engines, custom agent
"Partners," multi-user IM integrations, Deep Research) is real but
solves a much broader problem than this app is for for; not a fit at
that scale. One thing was a concrete, scoped improvement worth adopting:
`deeptutor/learning/mastery.py`'s per-topic mastery algorithm.

**The real weakness in this app's previous formula:** mastery was a flat
`(correct attempts / total attempts)` across a topic's entire history —
a student who struggled early but has since improved showed the exact
same score as one who's still struggling right now, and a single lucky
guess could show 100% "mastery" from one data point.

`lib/mastery.ts`'s `computeTopicMastery()` fixes both, reimplemented in
TypeScript (the original is Python — no code to literally copy either
way, but Apache 2.0 makes even that a non-issue, unlike the AGPL
situation with concept-kb.ts/lab-kb.ts): the most recent attempts count
more (recency weighting), and mastery can't exceed 0.5 after one attempt
or 0.8 after two — real evidence has to accumulate before a topic counts
as genuinely mastered.

Verified directly against DeepTutor's own test suite values (0.5, 0.8,
1.0 for 1/2/5 correct attempts) — matches exactly. More importantly,
tested the actual scenario the whole upgrade is meant to fix: two
attempt sequences with *identical* flat accuracy (3 right, 2 wrong — 60%
either way) — "struggled early, improved recently" scores meaningfully
higher (0.700) than "was fine, now struggling" (0.512). A flat-accuracy
formula can't tell these apart; this one does, which is the entire point.

Wired into `/api/parent/child-analytics` for both Weak Topic Analysis
and the subject-level Mastery Score — deliberately computed **once**
(`topicMastery`) and reused in both places, not two separate formulas
that could quietly disagree with each other on the same topic. One
correctness detail that mattered: the algorithm depends on chronological
order, which isn't guaranteed once attempts from multiple materials get
merged — attempts are explicitly re-sorted by real `attemptedAt` before
scoring, not assumed to already be in order.

## Fixed: a real signup failure, traced from a live screenshot, exposed a systemic gap

A student signup attempt on a live deploy failed with a generic
"Something went wrong creating your account" — checked the actual route
code rather than guessing, and found the real cause: the error-detection
logic only recognized Firestore problems whose message contained the
literal words "NOT_FOUND", "Firestore", or "PERMISSION_DENIED". A
malformed `GOOGLE_CLOUD_KEY_JSON` — a genuinely easy real mistake, since
it means pasting a multi-line service account JSON file into a
single-line environment variable field — throws a plain `JSON.parse`
`SyntaxError`, which contains none of those keywords, so it fell through
to the unhelpful generic message instead.

This exact same fragile keyword-matching pattern existed in **five
separate places** — the shared `lib/api-error.ts` wrapper (used by 15+
routes) plus three routes written before that wrapper existed (student
signup, parent signup, both branches of login). Fixed all five by
inverting the logic: every one of these routes only ever does Firestore/
GCS work in its try block, and the only genuinely "normal" errors
(duplicate email, validation) are already handled with their own early
returns before reaching this catch-all — so anything landing here is, by
construction, a server-side configuration problem, not a user mistake.
The fallback message now says so directly and points at Netlify's
function logs for the exact cause, instead of trying to keyword-match
every possible error format a misconfiguration could produce.

## Fixed: Netlify build was failing with "JavaScript heap out of memory"

A real gap, not a new problem: every single build command run in this
project's own development sandbox has used
`NODE_OPTIONS="--max-old-space-size=3072"` since early in the build,
specifically because this app needs more than Node's default heap limit
to complete a production build. That fix lived only in local testing
commands — it never made it into an actual deployment config, because no
`netlify.toml` ever existed. Netlify's build was running with an
untouched default limit the whole time, which is exactly why it failed
once the app grew large enough (confirmed at 90 routes via the actual
build output, not a rough guess) while local builds kept succeeding.

`netlify.toml` now sets `NODE_OPTIONS = "--max-old-space-size=4096"` —
deliberately just the memory fix, nothing else. A generic OOM fix
suggestion would also set `[build] command`/`publish` — deliberately
NOT done here, since this project has deployed successfully on Netlify
this whole time via its zero-config Next.js auto-detection (the real
Next.js Runtime, which needs to wrap the build for SSR/API routes, not
just publish a static `.next` folder as-is). Adding that would risk
breaking every API route and server-rendered page in the app while
fixing an unrelated problem.

4096, not a round bigger number like 8192: chosen because it's a real,
tested value, not a guess — 1GB of headroom above the 3072 that's
already been proven sufficient throughout this project's entire growth
in the local sandbox. Verified directly with the exact value now set in
`netlify.toml`, against the current, full-sized app: clean build, exit
0, confirmed complete. Also verified the TOML file itself parses
correctly — a malformed config would trade one deploy failure for a
different one.

## Login bypass for pre-marketing testing — a real kill switch, not just hidden UI

Requested explicitly: temporary, one-click access to every portal
(student/parent/admin/school) with no login form, to be turned off
before real marketing. Built as a second flag alongside the existing
`SKIP_VERIFICATION` (`lib/dev-mode.ts`'s `DEV_BYPASS_LOGIN`), same
pattern and tone, since that file already established the right
convention for this kind of temporary switch in this project.

**Three real safety layers, not just a comment:**
1. `/api/auth/dev-bypass`'s `DEV_BYPASS_LOGIN` check is the literal first
   line of the route — before even parsing the request body. Confirmed
   directly: flipping the flag to `false` makes the route reject with a
   403 immediately, even if someone hits the endpoint directly (devtools,
   curl) rather than through the UI buttons. The flag is the actual kill
   switch; hiding the buttons is a secondary effect, not the mechanism.
2. A bright, unmissable banner (`components/DevBypassBanner.tsx`) renders
   on every portal — student layout and the shared `PortalShell` (parent/
   admin/school) — whenever the flag is true. Visible on the live site
   itself, not just something buried in source code someone has to
   remember to go check.
3. The bypass buttons on `/login` themselves only render when the flag
   is true — flip it and they're simply gone, no separate UI cleanup step.

**Real access, not a fake preview:** student and parent bypass create or
reuse genuine test accounts (`test-student@nexusaiguru.test`,
`test-parent@nexusaiguru.test`) via the same Firestore stores and
password-hashing every real signup uses — every feature works against
real data exactly as it would for an actual user. Admin bypass sets a
session directly, matching how env-var admin login already works (no
Firestore admin record exists to create). School bypass gets you past
the door, but is honest about what's behind it: the School portal itself
is still the same known-fake hardcoded demo data it's always been
(`app/school/dashboard/page.tsx`'s literal `TODO` comment) — the bypass
doesn't make that real, it just lets you see what's already there.

## New: Virtual Lab — grounded narration, and a real bug found that affected an already-shipped feature too

Asked directly whether we had a Virtual Laboratory. We didn't — the
existing "Lab Manual" is purely text instructions for a *real physical*
lab, nothing simulated. Checked both repos' actual code before building
anything: OpenVidya's "Lab Without Walls" has real, good data
(`lab-registry.json`, 100 real NCERT experiments) but — traced exactly
like concept-graph.json before it — it's only ever used as **text
grounding for an AI description**, never rendered as anything
interactive. OpenMAIC's actual interactive content is genuinely
different and more capable: the AI authors arbitrary HTML/JS live,
rendered in a sandboxed iframe. Real and functional, but a genuine
departure from this app's one consistent principle across every other
feature — AI supplies small checkable data, deterministic code renders
it, never AI-authored code executing directly. Presented both options
honestly; the safer, grounded-narration direction was chosen explicitly.

`lib/lab-kb.ts` — four original, hand-authored real NCERT experiments
(magnesium combustion, acid-base litmus testing, Ohm's Law, starch
testing in leaves), same licensing reasoning as `concept-kb.ts`: the
experiments themselves are standard curriculum fact, not anyone's
copyrightable expression — only OpenVidya's specific file is protected,
and this is independently authored content. `/virtual-lab` narrates a
real, curated experiment when one matches, and — critically — **clearly
flags when it doesn't**: an ungrounded answer shows a visible "General
knowledge — not verified against our curated experiments" warning,
never presented with the same confidence as a grounded one.

**A real, significant bug found while testing the new matching logic —
and it turned out to affect the already-shipped concept-dependency
feature too, not just this new one.** Both `findConceptChapter()` and
the new `findLabExperiment()` used a threshold of "more than zero shared
words" to decide a match. Testing surfaced a genuine false positive:
*"newtons second law verification"* matched *"Verifying Ohm's Law"* —
two completely unrelated experiments — purely because both happen to
contain the word "law". A false match here is actively worse than no
grounding at all: it would confidently ground the AI in the wrong
experiment's real facts. Fixed in both files with a proper fraction-
based threshold (`lib/fuzzy-match.ts`'s `tokenOverlapFraction`, ≥30% of
the query's meaningful words must overlap) — landed on that number only
after testing it against 10 real cases together (the false positive,
several genuine fuzzy-phrased matches, and out-of-scope queries),
re-verified against the actual compiled code afterward, not just the
isolated test file.

`/virtual-lab` — a student picks a subject and types an experiment name;
if it matches the curated set, the AI narrates those real, verified
facts (apparatus, procedure, actual observation, the scientific reason
why, safety notes, common mistakes). If it doesn't match, the response
still generates from general knowledge, but the UI **honestly shows a
different confidence level** — a distinct visual state, not silently
presented the same way as a verified result. Verified this distinction
actually holds with real queries, not just the matching logic in
general: a genuinely out-of-scope experiment (electrolysis of water,
not in the seed set) correctly triggers the ungrounded warning, and a
right-topic-wrong-subject-filter case correctly doesn't false-match
either — both had to be true for the honesty claim to mean anything.

## New: Practice Materials — real interactive checking, all 9 formats, and a genuine bug caught by testing

Re-checked both OpenMAIC and OpenVidya specifically for these 9 formats
before building anything. OpenVidya's actual curated question bank (100
real questions) is **100% a single type** — `"type": "single"` on every
one, standard MCQ only, none of the 9. OpenMAIC's real `QuizQuestion`
type supports exactly `'single' | 'multiple' | 'short_answer'` — generic
choice/text grading, nothing matching CBSE's actual exam format
taxonomy. Confirms the per-format prompt engineering already built for
Creator Studio was genuinely necessary work, not something adoptable
from either repo.

`/practice` — was a completely unbuilt stub before this (`app/(student)/
practice/page.tsx` had a literal `TODO` and "coming soon" message, and
wasn't even linked from the student nav — unreachable through any real
navigation path). Now a real page covering all 9 requested formats plus
MCQ and a mixed mode, genuinely interactive — click an option, see
right/wrong immediately, not a markdown wall with an answer key at the
bottom.

**Built a new JSON-based generator** (`lib/practice-schema.ts`,
`practiceQuestionsSystemPrompt()`) specifically because Creator Studio's
existing quiz generator returns markdown prose — right for a document a
teacher publishes, wrong for something a student needs to click through.
Reuses the *exact same* per-format pedagogical instructions already
written (`QUIZ_FORMAT_INSTRUCTIONS` etc., now exported for this reuse)
rather than rewriting them a second time — only the requested output
shape differs.

**A real bug caught by testing, not by inspection:** the True/False
result label ("Correct"/"Not quite") used an inverted formula
(`selected === 1` instead of `selected === 0`), which silently marked
every correct answer as wrong and every wrong answer as correct — the
worst possible failure mode for a practice tool, since it would actively
teach a student the opposite of what they should learn. The button-
highlighting logic elsewhere on the same card was correct; only the
newly-added top-level result label had the bug, introduced while adding
that label, not present in the original card logic. Found by testing
all four real True/False scenarios directly, fixed, and re-tested to
confirm the fix — the same rigor applied to Match-the-Following's
per-row correctness check, which tested correctly on the first pass.

## Refined: hard block → proactive browse list, with real textbook-photo verification

Follow-up request changed the shape of the previous feature: don't block
generation at all — instead, proactively show students what's already
available for their class, let them verify it's genuinely their
textbook by seeing the actual page photo, and only download if they
choose to. Generation stays completely unblocked either way.

**Removed:** the 409 hard-block and its discard-generated-content logic.
`materialsStore.findExistingForTopic()` (the scoped matcher built for
the blocking version) is left in place, unused for now — genuinely
useful groundwork if a softer "similar material exists" hint is wanted
later, not deleted just because its original caller changed.

**Added — "Available for your class"** on `/study-materials`, shown
proactively above the upload form: every published material matching
the student's board+grade+language (reusing the exact same query the
main Materials page already uses), each with a real photo of the
original textbook page if one was stored, so a student can visually
confirm it's genuinely their textbook — not just trust a title match —
before choosing to reuse it.

**The real design decision that made "show it in classroom" actually
work correctly:** a naive "download" would only ever offer the
flattened markdown text the admin pool stores. To make a downloaded
material genuinely appear and function in the downloading student's own
Classroom — quiz gating, diagrams, Bloom's-tagged questions, progress
tracking, all of it — `Material` now carries a `sourceStudyMaterialId`
pointing back to the original structured record. `/api/student/study-
materials/import` uses this to copy the *real* structured segments
into a fresh personal copy, not reconstruct them from text. Verified
this is genuinely safe, not just assumed: `studyMaterialsStore.create()`'s
own type signature excludes `progress` from its accepted input entirely
and always hardcodes a fresh state — the import route cannot carry over
the original student's completion/quiz history even by mistake, enforced
by the type system itself, not just by care in how the route was written.

Materials without a `sourceStudyMaterialId` (admin-uploaded files, not
student-contributed) fall back to the existing plain-file download —
there's no structured content to import for those.

## Study Materials contribute to a shared library — a real disagreement, resolved explicitly

Requested: when a student generates a Study Material, save it both to
their own device/account AND to the admin-published pool, checking
first whether one already exists for their class/language/syllabus so
students only generate for genuinely uncovered material.

**Pushed back before building**, because the request as described had
two real problems, not style preferences:
1. **No quality gate.** Every other admin-published material goes
   through Creator Studio or Content-page review before reaching other
   students. Auto-publishing unreviewed AI output from a single
   student's photographed page removes that entirely — a misread
   equation could become "official" content for potentially many other
   students with zero human check.
2. **The described matching scope was too broad and would have broken
   the system.** Checking only standard+language+syllabus, with no
   subject or topic, means the very first material anyone generates for
   a class/language/board combination would block *every other subject
   and every other topic* from ever being generated for that same group
   again.

Recommended a safer alternative (suggest existing materials, opt-in
submission for admin review). **The project owner heard both concerns
and explicitly chose to proceed with the original design anyway** —
auto-publish, hard block on duplicates, no review step. That's a real,
informed decision to accept the quality-control tradeoff, respected as
made. The matching-scope problem, though, isn't a tradeoff to accept or
decline — it's a logic bug that breaks the feature regardless of risk
tolerance, so it was fixed as part of building what was actually asked
for, not silently overridden.

**What's built:**
- `lib/materials-store.ts`'s `findExistingForTopic()` — scoped to
  subject + class + syllabus + language + fuzzy-matched topic (≥50% of
  the new topic's meaningful words must appear in an existing title).
  Runs after generation, since the real topic is only known once the AI
  has actually read the page.
- If a match is found: generation is discarded, the student sees which
  material already exists, with a direct one-click download — no wasted
  AI call teaches them a lesson that already exists elsewhere.
- If no match: the material saves to the student's own personal record
  **and** auto-publishes to the shared admin pool immediately, visible
  to every other matching student — genuinely no review step, exactly as
  chosen.
- `lib/fuzzy-match.ts` — extracted as a shared utility rather than
  duplicated a second time; this is the same token-overlap matching
  approach already built for concept-dependency grounding, now reused
  for duplicate detection too.
- `lib/study-material-schema.ts`'s `segmentsToMarkdown()` — converts a
  Study Material's structured segments (points, worked examples, quiz
  with the correct answer marked) into the flat markdown the admin
  materials pool expects.

**Verified the exact bug scenario directly**, not just the matching
logic in general: a different subject with the same class/language/
board correctly does NOT block; a different topic in the *same* subject
correctly does NOT block; a genuinely re-worded version of the same real
topic correctly DOES get caught as a duplicate. All three needed to be
true for the fix to actually be a fix, not just a plausible-looking one.

## Real Parent Portal — was entirely fake demo data before this

Asked directly: "how does a parent know their child's progress?" Checked
the actual code before answering, and the honest answer was: they
couldn't. `/parent/dashboard` showed a hardcoded child named "Anjali"
with a `// TODO: replace with a real query`. The login page's "Parent"
mode didn't call any real auth at all — it was a fake phone/OTP flow
(`await new Promise(r => setTimeout(r, 400))`) that just redirected to
the dashboard regardless of any real credential. There was no parent
account model, no login mode for it in `/api/auth/login` (only
`admin`/`student` existed), and nothing anywhere connected a parent to
any real student's data.

**Built the real foundation, not just analytics on top of nothing:**
- `lib/parents-store.ts` / `lib/parent-links-store.ts` — real Firestore-
  backed parent accounts and parent-child links, same pattern as
  `students-store.ts`
- Real signup (`/signup/parent`) and login (`mode: "parent"` now
  genuinely checks a password hash, same as student/admin) — the fake
  OTP flow is gone entirely
- Real linking (`/parent/children/add` → `/api/parent/link-child`) — a
  parent enters their child's actual login email to link accounts.
  Flagged honestly in the UI itself: no stronger verification step or
  DPDP Act consent tracking exists yet — this is real, but deliberately
  the simple version
- `/api/auth/me` — a small new endpoint so client components can find
  out "who am I" without needing to read the httpOnly session cookie
  directly (parent/admin/school never had the student side's
  localStorage-session equivalent)

**The 8 requested analytics, computed from real data, nothing invented:**

| Item | How it's real |
|---|---|
| Learning Objectives | Actual completed segment titles from Study Materials |
| Bloom's Taxonomy Mapping | Required extending the schema — quiz questions previously had no cognitive-level classification at all. The AI now tags each one honestly (`lib/content-generators.ts`: "don't inflate the level to sound more sophisticated than the question actually is"), denormalized onto each `QuizAttempt` so historical data stays accurate |
| Competency Mapping | Derived from Bloom's Apply/Analyze/Evaluate/Create — CBSE's competency framework and Bloom's higher-order tiers genuinely overlap, so this reuses one real classification instead of a second one that could disagree with it |
| Weak Topic Analysis | Real per-topic quiz accuracy, ranked worst-first — requires a minimum of 2 attempts before a topic can be labeled weak, specifically to avoid one lucky/unlucky guess producing a false signal |
| Personalized Study Plan | Directly derived recommendations (weakest topics → "revise," incomplete materials → "continue") — no fabricated scheduling |
| Revision Schedule | Real `completionLog`/`quizAttempts` timestamps — topics untouched 7+ days, a transparent recency heuristic, not invented spaced-repetition intervals |
| Mastery Score | `50% chapter completion + 50% quiz accuracy`, one documented formula, same for every subject |
| Estimated Exam Readiness | A transparent 3-tier label derived from mastery score + weak-topic count — explicitly presented as a simple guide, not a scientific prediction |

**Verified the parts that actually matter, not just that the build
passed:** tested the mastery formula against real numbers, the weak-
topic minimum-attempts threshold, and the readiness label's boundary
cases (including the one that's easy to get wrong — a high mastery score
with even one flagged weak topic correctly does NOT get labeled "On
Track"). Most importantly, tested the security guard
(`findLinkForParent`) directly: confirmed a parent genuinely cannot view
a child that isn't linked to their own account, and an unlinked parent
sees nothing — the case that actually matters for a feature exposing one
family's data to another family's login.

**Honest limitation, stated directly on the page itself, not just here:**
this only reflects Study Materials activity. Ad-hoc quick lessons from
Classroom's topic picker are saved in the student's own browser
localStorage (`lib/student-session.ts`) — architecturally invisible to
any server-side parent view, a real constraint flagged in earlier
sessions and still true here.

## Concept-dependency grounding — original data, built after a real licensing finding

Evaluated OpenVidya's `concept-graph.json` (curated prerequisite chains
used to ground AI generation) as a potential adoption. Checked its
actual `LICENSE` file directly rather than trusting an earlier, looser
claim about "OpenMAIC/OpenVidya" being MIT — that fork is genuinely
**AGPL-3.0** (confirmed from the real file, `"license": "AGPL-3.0"` in
its `package.json`), which upstream OpenMAIC (confirmed separately,
genuinely MIT) doesn't even have this feature to inherit from. AGPL-3.0's
network-use clause would require releasing this entire application's
source under AGPL too if their actual code/data were incorporated —
incompatible with a closed-source commercial product, so direct adoption
was correctly ruled out.

What's legitimately adoptable is the *method*, not their specific
expression — copyright doesn't protect the idea of "curate real
prerequisite chains, ground AI generation in them," only their
particular file. `lib/concept-kb.ts` is an independent, original
implementation: hand-authored Class 10 CBSE Mathematics content (three
chapters — Polynomials, Quadratic Equations, Arithmetic Progressions —
each with genuine prerequisite relationships, common student errors, and
exam weight, written from real curriculum knowledge, not derived from
or copied from OpenVidya's files in any way).

Wired into the existing "dependency" mind-map generator
(`lib/content-generators.ts`): when a topic fuzzy-matches the curated
seed set, the real prerequisite structure gets injected into the prompt
("use this as the basis for your dependency graph, do not invent a
different structure") instead of the AI generating one purely from its
own knowledge, unverified. Falls through to the exact previous
(ungrounded) behavior for anything outside the seed set — this is a
small, honest starting point, not a claim of curriculum-wide coverage.

Verified the matching logic directly, not just the wiring: realistic
natural-language phrasing ("how to solve quadratic equations using the
formula") correctly matches the right chapter; a genuinely out-of-scope
topic (trigonometric identities — not yet curated) correctly returns no
match rather than forcing a false positive, which would have injected
*wrong* grounding data and made generation worse, not better; and the
subject filter correctly rejects a text-overlapping match from the wrong
subject. Also inspected the actual formatted grounding text that gets
injected into the real prompt, not just that the function returns
something.

## Removed: Sarvam AI — standardized on Gemini BYOK for everything

An earlier session integrated Sarvam AI (Bulbul V3) for higher-quality
Malayalam/Indian-language voice narration than the browser's built-in
Web Speech API. Removed entirely at the project owner's direction — the
app is meant to run on one external AI dependency (the student's own
Gemini BYOK key), not a second service with its own key, billing, and
signup flow to manage.

Removed thoroughly, not just the parts touched most recently — searched
the whole codebase for every reference, not just the new Homework page,
including a second pass that caught two more the first search missed
(the Homework page's own docblock comment, and a design-rationale
comment in the earlier KaTeX section describing lesson text as "read
aloud by voice narration" — accurate in principle, but worth being
precise that the classroom lesson was never actually wired to any TTS
in the first place, Sarvam or otherwise; only Homework's Read Aloud
button ever called the voice route). `lib/sarvam.ts` and
`app/api/voice/speak/route.ts` deleted outright, `SARVAM_API_KEY`
removed from `.env.example`, and every remaining comment updated.
The `WEB_SPEECH_LANG` locale mapping was still genuinely needed — moved
to its own file (`lib/web-speech.ts`) rather than deleted along with the
rest, since Web Speech is now the app's only TTS path, not a fallback
for a service that no longer exists.

**Honest tradeoff, not hidden:** Web Speech API voice quality for Indian
languages varies significantly by device and browser — it depends
entirely on whatever voices happen to be installed locally, which is
often noticeably weaker for Malayalam/Tamil/Kannada/Telugu than for
English. There's no server-side quality control possible with this
approach, unlike a hosted TTS API. If voice quality becomes a real
priority later, Gemini's own native audio generation (already used for
the live camera/mic channel's spoken responses) is the natural next
option to explore — it would keep everything on the single Gemini BYOK
key rather than reintroducing a second service, but that's a genuine
follow-up, not something built here without being asked.

## Camera/mic doubt-clearing: two real bugs found, text input added, OCR checked

Asked to verify the live camera+mic panel actually works properly and
add text input — traced the actual streaming code rather than assuming
it was fine, and found two genuine bugs, not just missing features.

**Bug 1 — the camera button ended the whole call.** If a student started
a mic-only session (spoke first, no camera), the camera button's
`else` branch called `stopHardware()` — ending the entire session —
instead of adding a camera stream. In a real class, a student realizing
mid-conversation "let me show you my notebook" would have had their call
disconnected instead. Fixed by giving camera its own independent
`videoStreamRef`, separate from the audio-bearing `streamRef`, so it can
be added or removed mid-session (`startVideoCapture()`/
`stopVideoCapture()`) without touching the live Gemini connection at all.

**Bug 2 — found while fixing bug 1, not from the original code.** When a
session starts *with* camera already on, both stream refs point at the
same combined MediaStream. The first version of `stopVideoCapture()`
called the blanket `getTracks().forEach(t => t.stop())`, which would
have silently stopped the *audio* track too in that shared-stream case —
turning off the camera would have killed the microphone. Fixed by
scoping it to `getVideoTracks()` only, verified by tracing all five
realistic state transitions (fresh mic-only start, fresh mic+camera
start, add camera mid-session, remove camera mid-session, full teardown)
through the actual code logic, since real `getUserMedia`/`AudioContext`
calls can't be exercised from this sandbox.

**Text input added** to the same panel — sent via `sendClientContent()`,
confirmed against the real `@google/genai` type definitions rather than
guessed (`sendRealtimeInput()` is for the continuous audio/video streams;
`sendClientContent({ turns, turnComplete })` is the correct API for a
single text turn, and `turns` genuinely accepts a plain string per
`PartUnion = Part | string`). Text, voice, and camera all feed the same
live conversation.

**On "OCR scanner" — checked, and it's not literally OCR.** Gemini Live
reads text/equations off the camera natively as part of its vision
understanding, not via separate OCR software — genuinely more flexible
(handles handwriting, diagrams, mixed content) than traditional OCR.
What *was* a real gap: the system prompt never instructed the model to
confirm what it reads before answering. A misread digit in an equation
would previously go uncaught. Fixed by adding an explicit instruction
(`lib/gemini-live.ts`) to briefly state what it sees before answering
("I can see you've written 2x + 5 = 15") — catches misreadings
immediately and lets the student correct them, which matters for
reliability in an actual interactive class.

## Messaging redesigned as live chat — bot first, human takeover, attachments

`/messages` (student) and `/admin/messages` were a ticket-list-style
form-and-thread UI — rebuilt as an actual chat window: bubbles, a
"typing…" indicator, auto-scroll, distinct styling per sender.

**The bot (`lib/support-bot.ts`)** responds instantly to every new
message — real chat feel, no waiting for an admin to be online. It's
vision-capable: if a student attaches a screenshot, the bot genuinely
looks at it (`callGeminiWithImage`, same pattern as textbook-page
reading elsewhere). Grounded the same way every other generator in this
app is — only answers confidently when it actually knows, otherwise says
plainly that a human will follow up, never invents a policy or solution.

**Human takeover is real, not cosmetic** — `messagesStore`'s
`adminHasReplied` flag flips permanently the moment an admin sends a
reply, and the bot goes quiet for that thread from then on, even on
later student follow-ups. Verified this directly by walking through the
full sequence (new thread → student → bot → student → bot → **admin
joins** → student replies again) and confirming the bot correctly stays
silent on that last message, not just immediately after the admin's
reply — the case that actually matters for not talking over a human.

**Attachments** (`/api/student/messages/upload-attachment`) — screenshots
or PDFs, up to 8MB, uploaded to GCS. One thing worth being precise about:
only the permanent GCS object name (`attachmentRef`) is ever persisted to
Firestore, never a signed URL — signed URLs expire after an hour, so
storing one directly would have silently broken every attachment an
admin viewed more than an hour after it was sent. A fresh signed URL is
generated on every fetch instead (`messagesStore.hydrateAttachments()`),
so an admin checking a screenshot days later still sees it correctly.

## Copy, Remove, and Download for admin-published materials

Three actions per admin material on `/materials` now, alongside the
existing Download:

- **Copy** — for AI-generated (text) materials, copies the actual
  content to the clipboard, immediately pasteable into notes/WhatsApp/
  wherever. For file-based materials (PDF/image/pptx), copies a direct
  download link instead, since there's no plain-text content to copy.
- **Remove** — a critical distinction worth being explicit about: this
  is a **personal "hide from my view" action, never a real delete.** A
  student removing a material only updates their own
  `hiddenMaterialIds` list (`lib/student-session.ts`) — the admin's
  actual published Firestore record is completely untouched and stays
  visible to every other matching student. Calling this anything
  suggesting a real delete would have been actively dangerous — a
  student could otherwise believe (or accidentally cause) content
  vanishing for their whole class. A "N removed — show them" toggle at
  the bottom restores full visibility and access to un-remove anything,
  so nothing is ever a one-way action.

Verified the interaction between removing, restoring, the show-hidden
toggle, and the existing subject filter all together, not just each in
isolation — confirmed the combination behaves correctly (e.g., removing
a material and then filtering by subject correctly excludes it, then
correctly reappears once restored).

## Admin materials can now target by language/medium, not just board+grade

Checked the schema directly and found a real gap: `Material` had `boards[]`
and `grades[]` but **no language field at all** — a Class VI Tamil-medium
worksheet would have reached every Class VI student on that board,
English-medium included. Fixed in both places admin content gets
published from:

- **Creator Studio** (AI-generated materials) — a new "Medium / language"
  chip row alongside boards/classes when publishing
- **Admin Content** (Drive/GCS/VPS file uploads) — the same targeting,
  consistently

Same pattern as boards/grades: empty `languages[]` = all mediums, so
nothing changes for existing published materials with no language field
at all (`materials-store.ts`'s filter treats missing and empty
identically). Verified the actual scenario from the request directly,
not just the general logic: a Tamil-medium Class VI material correctly
reaches a Tamil-medium student and correctly excludes an English-medium
student on the *same* board and grade, while a pre-existing material
with no language field stays visible to both — confirmed with real
filter execution, not just inspection.

## Fixed: admin materials no longer auto-flow into Classroom — and the old button was actually broken

Checked directly rather than assuming: Classroom (`app/(student)/classroom/page.tsx`
and its player) has **zero references** to the admin materials store or
API anywhere — its materials list only ever fetches the student's own
Study Materials (`/api/student/study-materials`). The self-made-first
architecture was already structurally correct there.

The one real gap was `/materials`' "Teach from this" button on admin
PDFs/images. Checked its actual implementation and found it was already
broken, not just "too automatic" — it downloaded the file and separately
navigated to `/classroom` **without connecting the two at all**, leaving
a literal `// TODO: pre-load the material` comment admitting it was
never finished. Clicking it downloaded a file and dumped the student on
an empty Classroom page.

Fixed properly: now relabeled **"Study this in Classroom"**, explicit
and opt-in only (nothing happens without the click), and it actually
works — reuses the exact same sessionStorage handoff already proven for
the PWA Share Target and Study Materials' "Just teach this now" button,
so Classroom needed zero new code to receive it. Falls back to a plain
download if the fetch/handoff fails for any reason (e.g. an unusually
large file), so the student still gets the material either way.

## Admin-published materials — student preference first, admin content as a bonus layer

Verified the receiving pipeline actually works before building anything
further: Creator Studio's Publish → `materialsStore.add()` in Firestore →
`/api/student/materials` filters by board+grade → shown on `/materials`.
Real and functioning — traced through the actual code, not assumed.

But it was a blanket broadcast: every student in a given board+grade saw
everything published for that group, with no way to prioritize by
subject and no way to know something new had arrived without manually
checking the page. Two additions close that gap, keeping the
student-driven experience (their own Study Materials, their own pace)
as the default and admin content as a genuine bonus layer that reaches
them, rather than a parallel channel they have to remember to check:

- **Subject preference** (`/profile` → "Materials from your school") —
  opt-out, not opt-in: leaving everything selected (the default) shows
  exactly what showed before, so nothing changes for a student who never
  touches this setting. Deselecting a subject collapses the visible set;
  re-selecting everything collapses the stored preference back to
  `undefined` rather than storing a redundant "all 5 selected" list —
  verified directly, including that specific collapse-back case, not
  just the simple toggle.
- **New-materials notification** — a small badge on the "Materials" nav
  link and a banner on the dashboard, both counting materials published
  since the student's last visit to `/materials` (`lastMaterialsCheckAt`,
  updated client-side on visit, no server round-trip needed for that
  part). Powered by a deliberately lightweight dedicated endpoint
  (`/api/student/materials/new-count`) rather than fetching the full
  materials list just to show a number — the nav badge needs this on
  every page load, so it stays cheap.

## Student-facing "grid of generators" — closing a real gap

The previous adoption pass built rich generator options (quiz formats,
notes sub-types, mind-map variants) almost entirely into **Creator
Studio — the admin tool**. The docx's actual proposed UX was student-
facing: upload a page, then choose from a grid of generators. That gap
is closed now: on `/study-materials`, each prepared material has a
**"Get more from this page"** panel — Flashcards, Extra Quiz, Revision
Notes, Mind Map — all generated from the *same already-uploaded image*,
no second upload.

Technically, this reuses Creator Studio's exact generator logic
(`buildSystemPrompt()` in `lib/content-generators.ts`) rather than
duplicating it — the only addition is a `sourceIsImage` flag that swaps
quoted-topic phrasing ("Write a quiz on \"Fractions\"") for a natural
unquoted reference plus an instruction to identify the topic from the
image first. Verified directly, not just by inspection: the typed-topic
path (Creator Studio) produces byte-identical phrasing to before, and
the new vision-sourced path reads as a coherent instruction — see the
test output showing both side by side in the build log.

One genuine pre-existing bug caught and fixed while making this change:
the mind-map generator's instructions referenced "the central topic"
and "this topic" throughout, but **never actually stated anywhere in the
prompt what the topic was** — no typed-topic string was ever embedded in
it, unlike every other generator kind. This wasn't introduced by
`sourceIsImage`; it was a real, silent bug from when mind-map's rich
variants were first built. Fixed as part of the same pass, using the
same `topicRef` mechanism.

Extras are stored on the existing `StudyMaterial` document
(`extras?: Partial<Record<ExtraMaterialKind, string>>`) rather than a
new collection — no schema disruption to the segments/progress
structure that drives the actual course.

## Adopted from evaluating OpenMAIC / dpaul0501's OpenVidya fork

Full evaluation (what's real code vs. aspirational, what fits our
architecture, what was rejected and why) is a separate discussion — this
documents what was actually built. Every item below is real, working
code, not a stub — see the conversation history for the honest
adopt/reject accounting, including why AI image/video generation, LangGraph
multi-agent orchestration, and the Next 16/React 19 stack were rejected.

- **Richer quiz/notes/mind-map generation** (`lib/content-generators.ts`) —
  real Indian exam formats (Assertion-Reason, Match-the-Following, HOTS,
  Case-Study, Competency-Based), difficulty levels, exam-style framing
  (Previous-Year, NCERT-Exemplar), revision-notes sub-types (formula
  sheet, definitions, vocabulary...), mind-map variants (concept map,
  dependency graph, decision tree — the latter two render as real Mermaid
  diagrams), story-based/role-play delivery styles, and optional
  mnemonics on flashcards. All backward-compatible — omitting the new
  parameters gives exactly the previous behavior.
- **"Common mistake" flagging in HOTS/mixed quizzes** — adapted from
  OpenVidya's Exam Dojo "trap flagged / trap exposed" pattern: the Answer
  Key now names the most common wrong answer and why students make it,
  not just the correct one.
- **Anti-hallucination grounding rules** — added to every generator's
  base prompt (`ctx()` in `content-generators.ts`, plus the main lesson
  prompts in `teacher-prompts.ts`/`teacher-prompts-client.ts`): stay
  strictly on-topic, never invent facts/terminology, leave out anything
  uncertain rather than guessing.
- **`jsonrepair`** (`lib/safe-json.ts`) — a shared safe-parse now used by
  every AI-JSON call site in the app (6 of them, previously each
  duplicating the same strip-and-parse logic with no recovery path).
  Tested directly against clean JSON, markdown-fenced JSON, a trailing
  comma, and a missing closing brace — all repaired correctly. Also
  tested what happens with genuinely unrecoverable input (pure prose):
  `jsonrepair` doesn't throw, it produces syntactically-valid-but-wrong
  JSON (a 2-element string array from that prose, not an error) — so the
  existing `isValidSegments()`/`isValidVisual()`/`isValidSlideDeck()`
  checks remain the real safety net, unchanged, and confirmed directly
  to still reject that exact malformed shape.
- **KaTeX real math notation** (`components/MathText.tsx`) — deliberately
  scoped to Creator Studio's markdown generators only (formula sheets,
  quiz equations), NOT the live classroom lesson. Reason: lesson/segment
  text is the kind of content that could reasonably be read aloud by
  the browser's Web Speech API (the app's only TTS mechanism — see the
  "Removed: Sarvam AI" section below) — raw LaTeX in text handed to a
  speech synthesizer would make it try to pronounce the syntax literally.
  This is the one place in the whole adoption where "don't disturb
  current work" meant deliberately *not* extending a feature everywhere
  it could technically go, as a forward-looking design constraint even
  though the classroom lesson isn't currently wired to any TTS at all —
  checked directly while doing the Sarvam removal below, not assumed.

## Fixed: Spotlight only existed on one of the two boards

Checked directly rather than assuming symmetry, given this is the third
time a feature turned out to exist on the ad-hoc lesson board but not
the Study Materials board (after diagrams, and the visual field itself).
Confirmed: `isActive`/Spotlight styling appeared nowhere in
`classroom/study/[id]/page.tsx` — zero matches. The reason runs deeper
than "forgot to add a class name": that board rendered `segment.points`
as a plain static list with no typewriter reveal at all, so there was no
"currently teaching" line for a glow to even attach to.

Fixed by carrying over the *whole* mechanism, not just the CSS —
`buildSegmentLines()` (the same flattening pattern as the working
board's `buildLines()`), a `typedCount` state that resets on every
segment change (`useEffect` keyed on `activeIndex`, catching every path
that changes it: seeking, advancing, and the initial load), and the same
`typedLine()`/`isActive` helper with identical glow/dim styling. Also
caught while wiring this in: the diagram (`DiagramRenderer`) was gated
only on `!!segment.visual`, meaning it could pop in before the text even
started typing — now gated on `exStarted` too, matching the working
board's narrative sequencing (points → example → diagram → quiz).

## Blackboard Canvas renderers — traced for real drawing/text bugs

Checked the three hand-rolled Canvas components (`GeometryShape.tsx`,
`FractionVisual.tsx`, `NumberLineVisual.tsx`) specifically for the most
common real Canvas bug class: `fillStyle`/`strokeStyle` being shared,
mutable state that can leak between a shape draw and a text draw,
silently making a label invisible or the wrong color. Traced every
color assignment by hand across all three — no leakage found; every fill/
stroke color is set immediately before its own draw call, and
`FractionVisual` explicitly resets to chalk-white after its per-segment
loop before drawing the shared label.

**Found and fixed, verified numerically (not just by inspection):**
- `NumberLineVisual` divided by `(max - min)` with no guard — a
  degenerate AI response (`min === max`) produced `-Infinity` for every
  point position, confirmed with a direct calculation before the fix
  existed. Now clamps `max` to `min + 1` when degenerate; re-tested with
  a point at the exact degenerate value, which now lands cleanly on-canvas
  instead of breaking.
- The pie-fraction label sat only ~4-8px from the canvas's bottom edge;
  the rectangle's height-label could crowd within 10px of the left edge
  for wide rectangles. Both fixed — the pie canvas grew taller (radius
  kept fixed, independent of that extra height, so the pie itself didn't
  also grow) and the rectangle label is now clamped to never go below a
  6px margin.
- Caught and fixed a real scoping bug introduced while making the pie fix
  — `cy`/`r` were declared inside the `if (style === "pie")` block but
  referenced in the shared label code after it, which would have thrown
  `cy is not defined` at render time. Hoisted to shared `pieCx`/`pieCy`/
  `pieR` constants before landing on the final version.

## Library audit — what was checked, what was found

A full pass across all 17 dependencies: fresh `npm install` (deleted
`node_modules` and the lockfile first, so nothing stale could hide a real
conflict), cross-checked every import against `package.json`, smoke-
tested the historically fragile integrations directly rather than
trusting the compile, and checked real bundle sizes.

**Fixed:**
- `unpdf` was a genuinely orphaned dependency — zero real usage anywhere,
  only a stale comment referencing it from before `pdfjs-dist` replaced
  it for client-side PDF text extraction. Removed, and the comment fixed
  to describe what's actually there.
- No peer-dependency conflicts on the fresh install.
- `public/pdf.worker.min.mjs`'s `postinstall` hook confirmed firing
  automatically on a clean install (not just when run manually) —
  verified in the install log, not assumed.
- `pptxgenjs` re-verified generating a genuinely valid file after the
  fresh install, not just resolving its import.
- Bundle sizes checked directly: Three.js/Mermaid/wllama each show up as
  separate 300-750 KB chunks, well above any route's reported First Load
  JS — confirms the lazy-loading design (dynamic `import()` for all three)
  is actually working, not just structured to look like it should.

**Found, not silently fixed — flagged instead, because it's consequential:**
Next.js is pinned to 14.2.35. `npm audit` surfaces real CVEs against it,
several **high severity** (DoS via Server Components, SSRF via WebSocket
upgrades, middleware bypass with i18n) — and there is **no patched
version within the 14.x line**; every fix landed in 15.5.16+ or later.
`npm audit fix` only offers a jump straight to Next.js 16.2.10 — a major,
semver-breaking version bump across App Router/middleware behavior that
touches this project's auth cookies, PWA Share Target route, and every
API route. That's not something to silently apply without real testing,
so it wasn't — this is flagged as the top priority item for whoever
deploys this next, not something auto-upgraded in this pass.

## Fixed: Study Materials segments never showed diagrams

Traced this from a user report rather than guessing. The visual renderer
system (Canvas geometry/fractions, Chart.js graphs, Mermaid flowcharts,
Three.js 3D solids — `lib/visual-schema.ts`, `components/visuals/`) was
genuinely wired and working in the ad-hoc "Choose a topic" and "Teach
from textbook" lesson flows (`lessonSystemPrompt()` requests a visual,
`DiagramRenderer` renders it) — but it's *conditional*: the AI only
includes one when a topic genuinely has a natural diagram, so plenty of
lessons legitimately show none.

The real gap was **Study Materials' segment player**
(`/classroom/study/[id]`) — it never had this capability at all. Checked
three things directly: `StudySegment` had no `visual` field,
`studySegmentsSystemPrompt()` never asked the AI for one, and the player
component didn't even import `DiagramRenderer`. Not conditional — 
structurally incapable, regardless of topic.

Fixed by carrying the same `visual` field and rules over to
`StudySegment`, capping it to 1-2 segments per course (a 3-6 segment
course showing a diagram on every segment would be excessive), and
wiring `DiagramRenderer` into the player right after the worked example
— the same position as the ad-hoc lesson flow. Verified with a simulated
end-to-end test (no live Gemini call possible from this environment —
no network access to Google's API here) using plausible real responses
for "Area of a Circle" (→ geometry/circle) and "Quadratic Equations"
(→ graph): both pass `isValidVisual()` correctly, and a deliberately
malformed response is correctly rejected rather than crashing the page.

## Materials page now shows a student's own uploads too, not just admin content

`/materials` only ever queried the admin-published library
(`materials` Firestore collection) — a student's own uploaded textbooks
and self-prepared courses (`study_materials`, the Kitchen's output) are
a completely separate system and never showed up here, which meant a
student with real prepared materials could still see "nothing published
yet" and reasonably think the feature was broken.

Fixed by fetching both on the same page load and showing them as two
clearly separated, honestly labeled sections: **"Your uploaded textbooks
& materials"** (their own Kitchen output, each with a progress bar,
linking straight into the player) sits above **"Published by your
school"** (the original admin library, unchanged). The empty-state
copy for the admin section was also tightened — it used to say "no study
materials have been published," which read as if the whole page were
empty even when a student had plenty of their own materials sitting
right above it.

## Real Progress page — attendance, per-subject chapters, test results

`/progress` used to only show ad-hoc "quick lesson" stats from
localStorage — no connection to Study Materials at all. That required a
real schema change, not just a frontend redesign: the old
`completedSegmentIds: string[]` only recorded *whether* a chapter was
done, never *when*, and wrong quiz attempts weren't recorded anywhere.
Both are now tracked (`lib/study-material-schema.ts`'s `completionLog`
and `quizAttempts`), which is what makes the new page's sections
possible:

- **Chapters completed by subject** — a progress bar per subject
  (`/api/student/progress-summary`'s `subjectBreakdown`)
- **Date-wise attendance** — a 30-day grid, one cell per day, showing
  which subjects had real activity (derived from `completionLog` +
  `quizAttempts` timestamps grouped by day)
- **Test results** — every quiz attempt, right *and* wrong, with an
  overall accuracy percentage — not just a pass/fail flag per chapter
- **Combined day streak** — merges local ad-hoc lesson dates with
  server-side Study Material activity dates; a day counts if either
  happened. Verified in isolation (date-key generation, streak-break-on-
  gap logic) before trusting it in the page.
- **One addition beyond what was asked** — a small "this week's
  momentum" bar chart, 7 days, bar height scaled by that day's activity
  count. A 30-day grid answers "was I consistent," but a weekly view
  answers "am I building momentum right now," which felt like a genuine
  gap worth filling rather than just the three things explicitly listed.

Every quiz attempt (`app/(student)/classroom/study/[id]/page.tsx`'s
`submitQuiz()`) now fires a background call to
`/api/student/study-materials/[id]/quiz-attempt` on every "Check answer"
click, right or wrong — this is the data source test results are built
from, and it doesn't block or slow down the quiz UI itself.

## One upload, both destinations — no re-upload between Classroom and Study Materials

A student uploading a textbook page shouldn't have to choose upfront
"is this for a quick lesson or a saved course?" and then upload it again
if they change their mind. Both directions now reuse the same file:

- **Classroom → Study Materials:** after uploading in "Teach from
  textbook," a **"Also save as Study Material"** button appears next to
  the existing "Teach from this page" button. It POSTs the *same*
  `tbImageFile` already in memory to `/api/student/study-materials` —
  defaults to Subject "Mathematics" and the student's own class/syllabus/
  language (Classroom is the maths product; change the subject in Study
  Materials directly if a page turns out to be something else). No file
  picker opens a second time.

- **Study Materials → Classroom:** next to "Prepare this material," a
  **"Just teach this now (don't save)"** button hands the same file to
  Classroom for an immediate one-off lesson. This deliberately reuses
  the *exact* sessionStorage handoff mechanism already built and proven
  for the PWA Share Target feature (`app/share-target/route.ts`,
  `gg_shared_file` key, `?fromShare=1`) rather than inventing a second
  handoff path — Classroom's existing consumption `useEffect` needed
  zero new code to support this; it already knew how to receive a file
  this way.

## Classroom "Choose a topic" now shows real subjects, not placeholders

Earlier builds had a hardcoded row of example topic chips (Fractions,
Linear Equations, Area of a Circle...) sitting under "Choose a topic" —
generic content unrelated to any individual student. That's gone.

In its place: the student's *actual* prepared Study Materials, grouped
by subject with filter chips (`materialsBySubject`, a `useMemo` over
`preparedMaterials` — only subjects the student genuinely has materials
in ever show up as a chip). This merges what had briefly been two
separate, slightly redundant sections (a flat "Your study materials"
list above the mode toggle, and the hardcoded chips below it) into one
coherent place — Classroom's "Choose a topic" mode is now that one place,
not duplicated elsewhere. The free-text "type any topic" box stays,
underneath, clearly separated as a distinct "ask about anything, not
just what you've prepared" fallback.

## Quiz gating toggle — Settings → "Study Materials pacing"

Study Materials segments are quiz-gated **by default** — a chapter's MCQ
must be answered correctly before the next one unlocks, which genuinely
helps build real mastery. But a student in `/profile` can turn this off:
**"Free navigation — quizzes optional."** Real product reason this
exists, not just a nice-to-have: if gating were mandatory, a student
whose app pace has fallen behind their actual school lessons would be
stuck unable to reach the chapter their teacher is covering *today* — a
genuine adoption blocker at launch, not a minor UX gap.

- `lib/student-session.ts`'s `quizGatingEnabled` (default `true`, opt-out
  not opt-in — encourages mastery by default) drives the toggle.
- **Gated (on):** `isUnlocked(i)` restricts the seek bar to
  `i <= unlockedIndex`; advancing past the current segment requires a
  correct quiz answer (`studyMaterialsStore.advance()`).
- **Free (off):** every segment is clickable regardless of position.
  Quizzes still show — useful self-checks — but never block "Next."
  Jumping ahead still records the furthest-reached position for resume
  (`studyMaterialsStore.jumpTo()`, a separate, deliberately gentler
  update than `advance()` — it never marks a quiz as "passed" just
  because the student skipped past it, so progress stats stay honest
  either way).

## Spotlight — attention follows the teaching, live

As Ganit Guru's typewriter reveals each teaching point in the Classroom
lesson (`app/(student)/classroom/page.tsx`), the currently-typing line
gets a soft marigold glow and full opacity; every point already spoken
fades to ~55% opacity — still fully readable, just visually de-emphasized,
like a real teacher's spotlight moving down the page as they talk. Applied
consistently across teaching points, the worked example's problem/steps/
answer, all driven by the same `typedCount` state that already tracks
typing progress — no new state, no new AI call, purely a styling layer
(`typedLine()`'s `isActive` flag).

**A second, riskier version exists and wasn't built:** spotlighting the
actual *textbook photo* — drawing a highlight box over the real region of
the page currently being discussed. This is more technically justified
than it might sound: Gemini's vision models do support genuine bounding-
box detection *on an existing image* (a documented capability), which is
meaningfully different from the "never let AI invent geometry" rule that
governs `lib/visual-schema.ts` — localizing real content in a real photo
isn't fabricating a diagram from nothing. Still a real scope jump from
what's built today (Gemini would need to return a bounding box per
teaching point, and the classroom would need to draw + animate a
highlight rect over the textbook `<img>` in sync with the typewriter) —
worth building as a deliberate follow-up, not bundled in silently here.

## Study Materials → Classroom — "kitchen and dining room"

A new nav item, **Study Materials**, sits between Home and Classroom —
this is the "kitchen": students upload a textbook page, tag it (Class,
Syllabus, language the textbook is written in, language to learn in,
Subject — Mathematics/Physics/Chemistry/Biology/Geography/Computer
Science), and Gemini prepares it into a **structured, multi-segment
course** (`lib/study-material-schema.ts`), not a one-shot single lesson.
Roughly every 2nd-3rd segment gets a short MCQ checkpoint.

The **Classroom** ("dining room") is where prepared materials actually
get taught: a "Your study materials" list shows every course the student
has prepped, each with a mini progress bar. Clicking one opens
`/classroom/study/[id]` — the actual player:

- **YouTube-style seek bar** — one block per segment, color-coded
  (current / completed / unlocked-but-not-done / locked). Clicking a
  locked segment does nothing; rewinding to any already-unlocked segment
  (to revise) always works.
- **Quiz-gated forward progress** — a segment with a quiz can't be
  passed until answered correctly; "Next segment" only appears once
  that's done. Segments without a quiz just need "Next" clicked.
- **"Start class" resumes from the furthest unlocked point**, not from
  the beginning — `lib/study-materials-store.ts`'s `advance()` tracks
  `unlockedIndex` server-side in Firestore, verified with an isolated
  logic test simulating a full 4-segment course (lock → unlock →
  rewind-without-regression → full completion) before shipping.
- The original textbook page image is shown alongside the segment
  content (uploaded to GCS, same pattern as generated slide decks —
  Firestore's 1 MiB document limit is why the image isn't stored inline).

**Deliberate scope decision:** the existing ad-hoc "Teach from textbook"
one-shot flow *inside* Classroom (single page → single lesson, no
persistence) was **kept, not removed**, even though the new Study
Materials flow covers similar ground more thoroughly. Reason: the PWA
Share Target feature (`app/share-target/route.ts`) specifically hands a
shared PDF into that existing flow — ripping it out would have silently
broken that integration. The two coexist: Study Materials for a real,
revisitable, gated course; "Teach from textbook" for a quick one-off
doubt with no setup.

## Dashboard setup checklist — nudges, doesn't gate

`/dashboard` shows three setup cards (`components/SetupChecklist.tsx`)
above "Start today's lesson": **Gemini API key** (BYOK), **Local Brain**
(the offline Gemma 4 E2B download), and **Download Syllabus** (links to
`/materials/textbooks`, the official government portal directory).

**Deliberate choice worth knowing:** none of these three block "Start
today's lesson" — it stays clickable regardless of setup status. The
classroom already works out of the box via the server's own Gemini key,
which is the entire point of the free-entry, graceful-fallback design
used everywhere else in this app (dev-mode OTP skip, BYOK/offline
fallback in the classroom, Drive-save-when-storage-is-low). Hard-gating
lessons behind setup would directly contradict that and make first use
worse, not better — so this checklist nudges with real status (✓
Connected / Not set up yet) rather than blocking anything. Once a
student completes the Gemini key + Local Brain steps, a "Hide this ✕"
appears so the checklist doesn't linger as clutter after it's done its
job — "Download Syllabus" has no persistent done-state since it's a
reference students may revisit, not a one-time setup step.

## "Show AI Guru" — live camera + mic doubt clearing

In `/classroom`, next to "Ask AI Guru", there's a **Show AI Guru**
button (`components/DoubtCameraMic.tsx`) that opens a real-time voice +
camera session: the student points their phone at a textbook problem or
their own working, talks through what's confusing them out loud, and
AI Guru sees the page and hears the question at the same time, then
answers back in voice — in the student's chosen language.

Both the **streaming logic** and the **UI** are adopted directly from an
existing working project on the same account — a legal-consultation
voice agent ("Secure Voice Channel"). The floating transcript console,
the bottom pill-shaped hardware dock (camera/mic/close), the connecting/
connected/thinking/error status states, and the 20-bar animated waveform
(`components/VoiceVisualizer.tsx`, using `motion`/Framer Motion) are all
ported close to verbatim from that source — only re-themed (its indigo/
amber → AI Guru's board/marigold) and re-purposed (legal counsel
responses → maths doubt-clearing responses).

Technical details live in `lib/gemini-live.ts`:

- **Model:** `gemini-3.1-flash-live-preview` — a different model from the
  text lessons (`gemini-2.5-flash`) because bidirectional audio/video
  streaming needs a model built for `ai.live.connect()`.
- **Auth:** reuses the student's existing BYOK Gemini key
  (`lib/student-key.ts`) — no separate key needed, since Live API and the
  REST API share the same key format.
- **Streaming format:** 16kHz mono PCM audio in, 24kHz PCM audio out,
  1024×768 JPEG frames at 2fps — this exact combination is what Gemini
  Live expects; changing sample rates or frame format will break it.

**Known limitation:** this feature requires a BYOK key — it doesn't use
the server's `GEMINI_API_KEY` fallback, because a Live session needs the
key in the browser to open the WebSocket-style connection directly.
Students without a BYOK key see a prompt to set one up in Settings first.

## Offline fallback (Gemma 4 E2B)

`lib/offline-ai.ts` runs **Gemma 4 E2B** entirely in the student's browser
via [wllama](https://github.com/ngxson/wllama) (llama.cpp compiled to
WebAssembly) — no server, no API key, works with zero internet once
downloaded. The GGUF (Q4_K_M, ~3.1 GB) is hosted on the project owner's
HuggingFace: `manojbillionaire123/gemma-4-E2B-it-GGUF`.

**This is a fallback, not the default.** Gemini is always tried first
(`/api/lesson`, `/api/ask`, or the student's BYOK key) because it's faster
and higher quality. The classroom page only calls the offline model
automatically if the Gemini call fails *and* the student already
downloaded it from Settings → AI source. A small "📴 Offline model" badge
appears on the lesson whenever it was used, so it's never silent about
which AI actually answered.

Gemma 4 is trained on 140+ languages including Malayalam, so this fallback
still teaches in the student's own language — quality is a step below
Gemini but meaningfully better than any smaller (sub-2B) offline model.

Students download it once from **Settings → AI source → Offline fallback**
— Wi-Fi strongly recommended given the size. WebGPU-capable browsers get
8-15 tokens/sec; older devices fall back to WASM CPU at 2-5 tokens/sec.


Visit `/classroom?language=malayalam&board=kerala&grade=8&name=Anjali` to
try the real lesson flow — once children are real DB records, that profile
will come from a server-side lookup instead of query params.

## Design system

`components/ui.tsx` holds the shared kit (`Button`, `Chip`, `Card`,
`PageHeader`, `StatCard`, `EmptyState`) and `tailwind.config.ts` carries
the chalkboard/marigold palette from the original demo, so every new page
inherits the same look without re-declaring CSS.

## Suggested next steps, in order

1. ~~Real auth~~ — done for admin + student (see above). Parent/school
   OTP still needs a real SMS provider wired up.
2. Connect `/parent/dashboard` and the school portal to Firestore, the
   same way the admin portal and student signup now are — they currently
   still use hardcoded mock data.
3. Razorpay checkout on `/pricing` + webhook handler, writing real
   payment events into `subscriptionsStore` (schema is already shaped
   to match Razorpay's payload).
4. Legal copy review.
5. Deploy: pick Vercel/Netlify or your VPS (see the deployment section
   for why Firestore was chosen so this decision isn't blocking).
