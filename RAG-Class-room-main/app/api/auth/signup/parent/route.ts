import { NextResponse } from "next/server";
import { parentsStore } from "@/lib/parents-store";
import { hashPassword } from "@/lib/password";
import { signSession } from "@/lib/session-sign";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup/parent
 * The missing counterpart to student signup — parents previously had no
 * way to create a real account at all.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { name, email, phone, password } = body;

  const required = { name, email, phone, password };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const parent = await parentsStore.create({ name, email, phone, passwordHash: hashPassword(password) });
    const { passwordHash, ...safe } = parent;
    // Issue the signed session cookie right away — /api/parent/* routes
    // now verify it.
    const session = { userId: parent.id, role: "parent" as const, name: parent.name, email: parent.email };
    const res = NextResponse.json({ parent: safe }, { status: 201 });
    res.cookies.set("gg_session", await signSession(session), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[/api/auth/signup/parent]", e.message);
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
