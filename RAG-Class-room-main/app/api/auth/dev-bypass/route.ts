import { NextResponse } from "next/server";
import { signSession } from "@/lib/session-sign";
import { studentsStore } from "@/lib/students-store";
import { parentsStore } from "@/lib/parents-store";
import { hashPassword } from "@/lib/password";
import { DEV_BYPASS_LOGIN } from "@/lib/dev-mode";
import { ROLE_HOME } from "@/lib/roles";
import { ADMIN_ENTRY_COOKIE, isValidAdminEntryKey, isValidAdminEntryProof, computeAdminEntryProof } from "@/lib/admin-entry";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/dev-bypass
 * body: { role: "student" | "parent" | "admin" | "school", key?: string }
 *
 * ONE-CLICK, NO-CREDENTIALS entry to any portal — see lib/dev-mode.ts's
 * DEV_BYPASS_LOGIN docblock for the full safety reasoning. This route
 * itself refuses to run at all when that flag is false — flipping the
 * flag is the actual kill switch, not just hiding the buttons in the UI.
 *
 * On top of that flag, this now ALSO requires a real secret
 * (lib/admin-entry.ts's ADMIN_ENTRY_KEY) — either typed directly (the
 * first time, from the login page) or proven via a cookie from an
 * earlier successful entry (subsequent switches from the persistent
 * portal switcher). Neither path works if ADMIN_ENTRY_KEY was never
 * configured — this fails closed, not open.
 *
 * Student/parent bypass creates or reuses a real, fixed test account
 * (test-student@nexusaiguru.test / test-parent@nexusaiguru.test) so
 * every feature works against genuine data, not a fake preview. Admin
 * bypass sets an admin session directly, same as env-var admin login —
 * there's no Firestore admin record to create. School bypass sets a
 * school session, but the School portal itself is still known-fake
 * demo data (hardcoded numbers, never built out) — this only gets you
 * past the door, it doesn't make what's behind it real.
 */
export async function POST(req: Request) {
  if (!DEV_BYPASS_LOGIN) {
    return NextResponse.json({ error: "Login bypass is turned off." }, { status: 403 });
  }

  const { role, key } = await req.json();
  const existingProof = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${ADMIN_ENTRY_COOKIE}=([^;]+)`))?.[1];

  if (!isValidAdminEntryKey(key) && !isValidAdminEntryProof(existingProof)) {
    return NextResponse.json({ error: "Incorrect or missing admin entry key." }, { status: 403 });
  }

  const proof = computeAdminEntryProof();
  function withProofCookie(res: NextResponse): NextResponse {
    if (proof) {
      res.cookies.set(ADMIN_ENTRY_COOKIE, proof, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24,
      });
    }
    return res;
  }

  const TEST_PASSWORD = "test-bypass-not-a-real-password";

  if (role === "student") {
    const email = "test-student@nexusaiguru.test";
    let student = await studentsStore.byEmail(email);
    if (!student) {
      student = await studentsStore.create({
        name: "Test Student", email, phone: "9999999999",
        className: "VIII", syllabus: "cbse",
        schoolName: "Test School", country: "India", state: "Kerala",
        district: "Thiruvananthapuram", place: "Thiruvananthapuram",
        languageId: "english", passwordHash: hashPassword(TEST_PASSWORD),
      });
    }
    await studentsStore.touchLastActive(student.id);

    const session = { userId: student.id, role: "student" as const, name: student.name, email: student.email };
    const res = NextResponse.json({
      ok: true, redirect: "/dashboard",
      student: { id: student.id, name: student.name, email: student.email,
        className: student.className, syllabus: student.syllabus, languageId: student.languageId,
        schoolName: student.schoolName, state: student.state, district: student.district, place: student.place },
    });
    res.cookies.set("gg_session", await signSession(session), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24,
    });
    return withProofCookie(res);
  }

  if (role === "parent") {
    const email = "test-parent@nexusaiguru.test";
    let parent = await parentsStore.byEmail(email);
    if (!parent) {
      parent = await parentsStore.create({
        name: "Test Parent", email, phone: "9999999998",
        passwordHash: hashPassword(TEST_PASSWORD),
      });
    }
    await parentsStore.touchLastActive(parent.id);

    const session = { userId: parent.id, role: "parent" as const, name: parent.name, email: parent.email };
    const res = NextResponse.json({ ok: true, redirect: ROLE_HOME.parent });
    res.cookies.set("gg_session", await signSession(session), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24,
    });
    return withProofCookie(res);
  }

  if (role === "admin") {
    const session = { userId: "test-admin", role: "admin" as const, name: "Test Admin" };
    const res = NextResponse.json({ ok: true, redirect: ROLE_HOME.admin });
    res.cookies.set("gg_session", await signSession(session), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24,
    });
    return withProofCookie(res);
  }

  if (role === "school") {
    const session = { userId: "test-school", role: "school" as const, name: "Test School" };
    const res = NextResponse.json({ ok: true, redirect: ROLE_HOME.school });
    res.cookies.set("gg_session", await signSession(session), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24,
    });
    return withProofCookie(res);
  }

  return NextResponse.json({ error: "Invalid role." }, { status: 400 });
}
