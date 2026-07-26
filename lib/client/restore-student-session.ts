"use client";
/**
 * restoreStudentSession — the self-healing replacement for a bare
 * `studentSession.get()` check on page mount.
 *
 * Every student page used to do:
 *   const p = studentSession.get();
 *   if (!p) { router.push("/login"); return; }
 *
 * That trusts ONLY the localStorage profile. But the student is really
 * "logged in" as long as the long-lived signed `gg_session` cookie
 * (lib/auth.ts, now 180 days — see /api/auth/login) is valid, whether
 * or not the localStorage copy of their profile happens to still be
 * there. Losing just the localStorage copy (Safari's storage eviction,
 * a browser "clear site data", the installed-PWA-vs-Safari-tab split
 * storage on iOS, low-storage cleanup, ...) used to be indistinguishable
 * from actually being logged out, and sent the student straight back to
 * /login mid-lesson.
 *
 * This checks localStorage first (instant, the common case), and only
 * if that's empty does it ask the server "is my cookie still valid?" —
 * if so, it quietly rebuilds the localStorage profile from the student's
 * own record and the student never sees a login screen at all. Only a
 * genuinely invalid/expired cookie (or an explicit logout) results in
 * `null`, i.e. an actual redirect to /login.
 */
import { studentSession, type StudentProfile } from "@/lib/student-session";

export async function restoreStudentSession(): Promise<StudentProfile | null> {
  const cached = studentSession.get();
  if (cached) return cached;

  try {
    const res = await fetch("/api/student/restore-session", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    const s = data?.student;
    if (!s) return null;

    // Rebuild the localStorage profile from the server record. Fields
    // that only ever lived client-side (teaching style, subject
    // preferences, etc.) aren't on the server record, so they fall back
    // to studentSession.save()'s own sensible defaults rather than being
    // guessed here — a student who loses local storage gets a working,
    // if freshly-defaulted, set of preferences instead of a login wall.
    studentSession.save({
      name: s.name, email: s.email, phone: s.phone || "",
      className: s.className, syllabus: s.syllabus,
      schoolName: s.schoolName, state: s.state, district: s.district, place: s.place,
      languageId: s.languageId,
    });
    return studentSession.get();
  } catch {
    // Couldn't reach the server to confirm the cookie, and there was no
    // local profile to fall back on either — genuinely can't render the
    // page (no grade/board/language known), so this does end up sending
    // the student to /login. This only happens when BOTH local storage
    // is empty AND the network call fails, which is rare.
    return null;
  }
}
