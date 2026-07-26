import { NextResponse } from "next/server";
import { signSession } from "@/lib/session-sign";
import { studentsStore } from "@/lib/students-store";
import { parentsStore } from "@/lib/parents-store";
import { verifyPassword } from "@/lib/password";
import { ROLE_HOME } from "@/lib/roles";
import { rateLimit, rateLimitClear, clientIp } from "@/lib/rate-limit";

// Always hit the database live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * body: { mode: "admin" | "student" | "parent", email, password }
 *
 * Admin login checks against ADMIN_EMAIL / ADMIN_PASSWORD environment
 * variables — set these in .env.local / Vercel / Netlify. This is what
 * makes "log in as admin, see a different version of the app" real:
 * the session cookie's role decides which portal (student vs admin)
 * every subsequent page renders, via middleware.ts.
 *
 * Student login checks the student record created at signup.
 * Parent login checks the parent record created at signup —
 * this mode didn't exist until now; /parent/* pages were unreachable
 * through any real authentication path before this.
 */
export async function POST(req: Request) {
  const { mode, email, password } = await req.json();

  if (!email || (mode !== "student" && !password)) {
    return NextResponse.json({ error: mode === "student" ? "Email is required." : "Email and password are required." }, { status: 400 });
  }

  // Brute-force guard: 8 attempts / 15 min per account, 30 / 15 min per
  // IP (the second catches spraying one password across many accounts).
  // Counters clear on a successful login so a fumbled-then-remembered
  // password doesn't lock a real user out.
  const WINDOW = 15 * 60 * 1000;
  const emailKey = `login:e:${String(email).trim().toLowerCase()}`;
  const ipKey    = `login:ip:${clientIp(req)}`;
  const byEmailLimit = rateLimit(emailKey, 8, WINDOW);
  const byIpLimit    = rateLimit(ipKey, 30, WINDOW);
  if (byEmailLimit.limited || byIpLimit.limited) {
    const retry = Math.max(byEmailLimit.retryAfterSec, byIpLimit.retryAfterSec);
    return NextResponse.json(
      { error: `Too many login attempts. Please wait about ${Math.ceil(retry / 60)} minute(s) and try again.` },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }

  if (mode === "admin") {
    const adminEmail    = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: "Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in your environment variables." },
        { status: 503 },
      );
    }
    if (email.toLowerCase() !== adminEmail.toLowerCase() || password !== adminPassword) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }

    rateLimitClear(emailKey);
    const session = { userId: "admin", role: "admin" as const, name: "Admin", email: adminEmail };
    const res = NextResponse.json({ ok: true, redirect: ROLE_HOME.admin });
    res.cookies.set("gg_session", await signSession(session), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }

  if (mode === "student") {
    try {
      const student = await studentsStore.byEmail(email);
      console.log(`[login] student found: ${!!student}, password provided: ${!!password}`);
      // If student exists, check password only if they provide one
      if (!student || (password && !verifyPassword(password, student.passwordHash))) {
        return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
      }
      await studentsStore.touchLastActive(student.id);

      // This cookie is the source of truth for /api/student/restore-session
      // (lib/client/restore-student-session.ts), which silently rebuilds a
      // student's localStorage profile if it's ever lost — so it needs a
      // genuinely long lifetime, not just "session cookie parity." 180
      // days means a student who logs in once stays logged in across
      // months of normal use instead of being asked again every few weeks.
      rateLimitClear(emailKey);
      const session = { userId: student.id, role: "student" as const, name: student.name, email: student.email };
      const res = NextResponse.json({
        ok: true,
        redirect: "/dashboard",
        student: { id: student.id, name: student.name, email: student.email,
          className: student.className, syllabus: student.syllabus, languageId: student.languageId,
          schoolName: student.schoolName, state: student.state, district: student.district, place: student.place },
      });
      res.cookies.set("gg_session", await signSession(session), {
        httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180,
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    } catch (e: any) {
      // Never leak a raw gRPC/JSON-parse error directly to the screen —
      // give a clear, actionable message instead. Deliberately not
      // keyword-matching the error text (a malformed GOOGLE_CLOUD_KEY_JSON
      // throws a plain SyntaxError with none of the expected keywords,
      // which used to fall through to a vague, unhelpful message).
      console.error("[/api/auth/login student]", e.message);
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

  if (mode === "parent") {
    try {
      const parent = await parentsStore.byEmail(email);
      if (!parent || !verifyPassword(password, parent.passwordHash)) {
        return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
      }
      await parentsStore.touchLastActive(parent.id);

      rateLimitClear(emailKey);
      const session = { userId: parent.id, role: "parent" as const, name: parent.name, email: parent.email };
      const res = NextResponse.json({ ok: true, redirect: ROLE_HOME.parent });
      res.cookies.set("gg_session", await signSession(session), {
        httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    } catch (e: any) {
      console.error("[/api/auth/login parent]", e.message);
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

  return NextResponse.json({ error: "Invalid login mode." }, { status: 400 });
}
