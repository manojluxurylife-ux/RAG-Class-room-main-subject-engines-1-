# Security Hardening — 2026-07-19

Five defects found in a full codebase audit, all fixed and verified in this
delivery. `tsc --noEmit` clean, `next build` 74/74 pages, existing whiteboard
tests 4/4, new `tests/security.test.ts` 6/6, plus a live smoke test against
`next start` (documented at the bottom).

## 1. `/api/student/*` and `/api/parent/*` now verify the session cookie

**Was:** ~30 routes identified the caller purely by a `studentId` /
`parentId` / `email` query or body parameter. Anyone who knew (or guessed) a
child's id could read their analytics, messages, exam history and
subscription, and write data (submit exams, post replies) as them.

**Now:** the signed `gg_session` cookie is the source of truth. New helpers
in `lib/auth.ts`:

- `requireStudentMatching(requested?)` — caller must be signed in as the
  student the request names. Accepts either the student's **id or email**
  (several routes historically key by email — subscription, messages).
  Admins pass, for support tooling. Older cookies without the new `email`
  field fall back to one store lookup instead of logging the student out.
- `requireParentMatching(requested?)` — same contract for parent routes.
- `sessionOwns(session, owner)` — ownership test used by resource-id routes:
  `exam-room/[id]` (view/submit/self-mark) and `messages/[id]/reply` load
  the record first and return the **same 404** for "doesn't exist" and
  "not yours", so attempt/thread ids can't be probed.
- `requireAnySession()` — any signed-in user; used where data isn't
  per-student (published materials list, shared exam patterns).

The API shapes are unchanged — clients keep sending the same params; the
server now only checks they agree with the cookie. Same-origin `fetch`
sends cookies automatically, so no client code changes were needed.

**Signup fix that made this safe to ship:** the signup routes never issued
the session cookie — only `/login` did — so a freshly signed-up
(passwordless) student would have been locked out of every guarded API.
Both signup routes now set the signed cookie on success, same as login.

## 2. Session signing fails closed in production

**Was:** with neither `SESSION_SECRET` nor `ADMIN_PASSWORD` set, cookies
were signed with the hard-coded `"gg-dev-only-secret"` — publicly readable
in the source, so anyone could forge a valid admin cookie.

**Now:** `lib/session-sign.ts` throws in production if no real secret is
configured. Localhost dev still works with zero setup.

## 3. Server-key AI routes require a signed-in user

**Was:** `/api/ask`, `/api/lesson`, `/api/textbook`, `/api/rag/{ask,lesson,
context,ingest}`, `/api/math-ocr`, `/api/material-studio/generate`,
`/api/student/{practice,virtual-lab}` and the exam-room generation routes
spent the app's `GEMINI_API_KEY` (or OCR worker) with no auth — open
quota drain. BYOK moved the *client* off these paths, but the endpoints
themselves stayed live.

**Now:** all of them return 401 without a valid session. BYOK browser-side
calls are unaffected (they never touch these routes).

## 4. Login brute-force rate limiting

New `lib/rate-limit.ts` (in-memory sliding window): 8 attempts / 15 min per
account + 30 / 15 min per IP on `/api/auth/login`, 429 with `Retry-After`.
Counters clear on successful login. **Honest limitation:** per-process
memory — exact on the single-VPS/PM2 deployment; on Netlify functions each
warm instance counts separately (a speed bump, not a wall). The interface
is one function — swap the Map for Upstash (`db-upstash.ts` already exists)
to make it global.

## 5. VPS path traversal closed

`/api/admin/vps?subfolder=../../..` walked straight into `path.join` and
listed arbitrary server directories. `lib/storage/vps.ts` now resolves and
prefix-checks every subfolder against `public/materials/` (absolute paths
and any `..` escape rejected), and `vpsPublicUrl` applies the same guard to
`sourceRef` so a crafted ref can't redirect outside `/materials/`.

## Also in this pass

- `gg_session` (and the admin-entry proof cookie) now set
  `secure: true` in production everywhere they're issued
  (login × 3 roles, both signups, dev-bypass × 5).
- Sessions now carry `email`, which lets email-keyed routes verify
  ownership without a store lookup.
- `messagesStore` already exposed `byId` — reply now uses it for the
  pre-write ownership check.

## Deployment notes

- **Set `SESSION_SECRET` (or keep `ADMIN_PASSWORD` set) before deploying** —
  production now refuses to run without one (deliberate, see #2).
- Students signed in before this release have cookies without `email`;
  everything still works via the lookup fallback, and their next login
  upgrades the cookie.
- Guarded APIs mean a logged-out visitor on /classroom gets a clean 401
  ("Please log in…") from AI endpoints instead of free server AI — if a
  no-login demo mode is ever wanted, gate it explicitly rather than
  reopening these routes.

## Live smoke-test transcript (next start, production mode)

- Anonymous `GET /api/student/analytics?studentId=x` → **401**
- Anonymous `GET /api/parent/children?parentId=p1` → **401**
- Anonymous `POST /api/ask` → **401**
- Forged plain-JSON admin cookie on `/api/admin/*` → **401**
- Admin login → cookie → admin passes student matcher (support access) ✓
- `/api/admin/vps?subfolder=../../../../etc` with valid admin cookie →
  `{"files":[]}` (rejected), not a directory listing
- 9 wrong passwords → eight **401**s then **429**
- Student signup → cookie issued → own analytics **200**, own
  subscription-by-email **200**, someone else's analytics **403**
