import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { studentsStore } from "@/lib/students-store";
import { hashPassword } from "@/lib/password";
import { signSession } from "@/lib/session-sign";

// Always hit the database live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup/student
 * Persists the student to the database (students-store, Upstash Redis in
 * production) so the admin can
 * actually see them — this is the missing server-side counterpart to
 * lib/student-session.ts, which only ever wrote to the browser's
 * localStorage.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    name, email, phone, className, syllabus, schoolName,
    country, state, district, place, password, languageId = "english",
  } = body;

  const required = { name, email, phone, className, syllabus, schoolName, country, state, district, place };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
  }
  // DEV-STAGE PASSWORDLESS ENTRY: password is optional. When absent, a
  // random unguessable one is generated server-side so the record still
  // has a real hash (no "" hashes that a password of "" could match) and
  // password-login for the account is effectively disabled — the student
  // enters via the signup session / Easy-pass cookie. Before launch,
  // either restore the password field or add an OTP path; Forgot-password
  // already lets any student set one later.
  if (password && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const effectivePassword = password || randomBytes(24).toString("hex");

  try {
    const student = await studentsStore.create({
      name, email, phone, className, syllabus, schoolName,
      country, state, district, place, languageId,
      passwordHash: hashPassword(effectivePassword),
    });

    const { passwordHash, ...safe } = student;
    // Issue the signed session cookie right away — /api/student/* routes
    // now verify it, and without this a freshly signed-up (possibly
    // passwordless) student would be locked out of every API until they
    // went through /login separately.
    const session = { userId: student.id, role: "student" as const, name: student.name, email: student.email };
    const res = NextResponse.json({ student: safe }, { status: 201 });
    res.cookies.set("gg_session", await signSession(session), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (e: any) {
    // Only the specific "duplicate email" case from studentsStore.create()
    // is a genuine 409 Conflict. Anything else (Upstash env vars missing,
    // wrong credentials, network failure) is a server problem, not something
    // the student did wrong — surface it as a 500 with a clear message
    // instead of leaking a raw Redis/network error to the screen.
    if (e.message?.includes("already exists")) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[/api/auth/signup/student] ERROR:", e);
    return NextResponse.json(
      {
        error: "The server hit a configuration problem — this isn't something you did wrong. " +
          "(Admin: check your deployment platform's logs for this request for the exact cause — common ones are " +
          "missing database environment variables (e.g. UPSTASH_REDIS_REST_URL/TOKEN). See .env.example.)",
      },
      { status: 500 },
    );
  }
}
