"use client";
/**
 * Verifies the REAL server session before letting a student proceed
 * into a flow that will call an authenticated API (upload, ingest, ask,
 * generate, submitting a chapter exam, ...).
 *
 * WHY THIS EXISTS: pages check `studentSession.get()` (see
 * lib/student-session.ts) to decide whether to show student-only UI at
 * all — but that's a client-side localStorage profile with NO expiry
 * and NO relationship to the real signed `gg_session` cookie the server
 * actually checks (see middleware.ts / lib/auth.ts). A student whose
 * cookie expired, was cleared, or — the single most common real case —
 * whose account was created before session cookies were wired up at
 * signup at all, still has a truthy `studentSession.get()` forever. The
 * page renders completely normally; only the underlying API call fails,
 * with a 401 "Please log in to use this feature." For the RAG Classroom
 * specifically, this is especially costly: a student can complete an
 * entire chapter exam, see their score displayed with full confidence,
 * and have the result silently fail to reach chapterAssessmentsStore —
 * meaning it never reaches the Parent Portal — with only an easily
 * missed toast as the only signal anything went wrong.
 *
 * This checks the real session via /api/auth/me (always 200, `{session:
 * null}` on no session — safe to call speculatively) and, if it's
 * missing, clears the stale local profile (so it stops lying) and
 * redirects to /login with a return path — BEFORE the student invests
 * time in a flow that's doomed to fail. Also meant to be called from an
 * API call's own 401 handler (not just on page mount), since a cookie
 * can still expire mid-session during a long-running class or exam —
 * a mount-time check alone wouldn't catch that.
 */
import { studentSession } from "@/lib/student-session";

export async function hasValidSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.session;
  } catch {
    // A network hiccup shouldn't itself look like "not logged in" — let
    // the real API call (upload/ingest/exam-submit/etc.) surface the
    // actual error; this check is a fast-path improvement, not the
    // only safety net.
    return true;
  }
}

/**
 * Redirects to /login?next=<path> and clears the stale local profile so
 * it can't keep telling the rest of the app "you're logged in" after
 * this. Call this once you already know the session is invalid (either
 * from hasValidSession() returning false, or from an API call that
 * itself returned 401).
 */
export function redirectToLogin(router: { push: (href: string) => void }, currentPath: string) {
  studentSession.clear();
  router.push(`/login?next=${encodeURIComponent(currentPath)}`);
}

/** True for a fetch Response that failed specifically because the
 *  session is missing/invalid — matches the exact shape every guarded
 *  API route in this app returns (see lib/auth.ts's requireStudent /
 *  requireStudentMatching / requireAnySession and the plain
 *  `getSession()` checks). Use this in a catch/error branch to tell
 *  "you're not logged in" apart from a genuine processing failure, so
 *  the two don't get the same dead-end error banner. */
export function isSessionExpiredResponse(status: number, errorMessage?: string): boolean {
  return status === 401 || status === 403 || /log in to use this feature/i.test(errorMessage || "");
}
