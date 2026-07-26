import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/session-sign";

const PROTECTED_PREFIXES: Record<string, "parent" | "school" | "admin"> = {
  "/parent": "parent",
  "/school": "school",
  "/admin": "admin",
  // Admin APIs are role-guarded too — page-level guarding alone leaves
  // every /api/admin endpoint (users, stats, subscriptions, billing
  // actions) callable by anyone who knows the URL.
  "/api/admin": "admin",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const prefix = Object.keys(PROTECTED_PREFIXES).find((p) => pathname.startsWith(p));
  if (!prefix) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  const deny = () => isApi
    ? NextResponse.json({ error: "Admin access required." }, { status: 401 })
    : (() => {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(loginUrl);
      })();

  const raw = req.cookies.get("gg_session")?.value;
  // Signature verified BEFORE the role is trusted — an unsigned or
  // tampered cookie (including the old plain-JSON format) is a denial,
  // not a fallback.
  const parsed = await verifySession<{ role?: string }>(raw);
  if (!parsed) return deny();

  const requiredRole = PROTECTED_PREFIXES[prefix];
  if (parsed.role !== requiredRole && parsed.role !== "admin") return deny();

  return NextResponse.next();
}

export const config = {
  matcher: ["/parent/:path*", "/school/:path*", "/admin/:path*", "/api/admin/:path*"],
};
