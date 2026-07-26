import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { studentsStore } from "@/lib/students-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/restore-session
 *
 * WHY THIS EXISTS: the student side of the app is "logged in" according
 * to two independent things — the long-lived, httpOnly, signed
 * `gg_session` cookie (server-side, survives forever until it expires
 * or the student explicitly logs out) and a plain localStorage profile
 * (lib/student-session.ts, used for fast client-side reads everywhere:
 * the classroom, materials, BYOK key, lesson history). Every student
 * page used to trust ONLY the localStorage copy — if that ever went
 * missing (Safari's ~7-day eviction of script-writable storage for
 * sites not "engaged" with recently, a browser/PWA "clear site data",
 * switching between the installed PWA and a plain browser tab on iOS —
 * these use SEPARATE storage on iOS Safari — or just the student
 * clearing their browser), the page saw `null` and bounced straight to
 * /login mid-session, even though the real, still-valid signed cookie
 * was sitting right there proving who they are. That is almost
 * certainly what "suddenly drops back to the login page" was.
 *
 * This endpoint lets the client silently rebuild the localStorage
 * profile from the cookie instead of forcing a full re-login — see
 * lib/client/restore-student-session.ts for the caller.
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json({ student: null }, { status: 401 });
  }

  const record = await studentsStore.byId(session.userId);
  if (!record) return NextResponse.json({ student: null }, { status: 401 });

  const { passwordHash, ...safe } = record;
  return NextResponse.json({ student: safe });
}
