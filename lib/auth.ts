import { cookies } from "next/headers";
import { verifySession } from "@/lib/session-sign";

export type Role = "student" | "parent" | "school" | "admin";

export interface Session {
  userId: string;
  role: Role;
  name: string;
  /** Present on sessions issued after the auth hardening — older cookies
   *  lack it, so identity-matching falls back to a store lookup. */
  email?: string;
}

// Sessions are HMAC-signed (lib/session-sign.ts) — a tampered or
// hand-crafted cookie verifies to null, so a forged {"role":"admin"}
// no longer opens any portal. Async because Web Crypto's HMAC is.
export async function getSession(): Promise<Session | null> {
  const raw = cookies().get("gg_session")?.value;
  return verifySession<Session>(raw);
}


export async function requireRole(role: Role): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== role) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  return session;
}

export async function requireStudent(): Promise<Session> {
  return requireRole("student");
}

export async function requireParent(): Promise<Session> {
  return requireRole("parent");
}

/** Any signed-in user (student/parent/school/admin) — used on routes that
 *  spend the server's Gemini key, to stop anonymous quota drain without
 *  restricting which portal may call them. */
export async function requireAnySession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  return session;
}

function forbid(): never {
  throw Object.assign(
    new Error("You can only access your own data."),
    { status: 403 },
  );
}

/**
 * The caller must be signed in as the student identified by `requested`
 * (which routes historically pass as either the student's id OR email —
 * both are accepted), or be an admin. Returns the session so callers can
 * use session.userId as the canonical id. `requested` may be omitted for
 * routes with no per-student parameter — then any student session passes.
 *
 * WHY not just trust the query param: /api/student/* used to be
 * identified purely by ?studentId=, letting anyone read any child's
 * analytics, messages and exam history by supplying a different id.
 * The signed cookie is now the source of truth; the param is only
 * checked for agreement so existing clients keep working unchanged.
 */
export async function requireStudentMatching(requested?: string | null): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  if (session.role === "admin") return session;
  if (session.role !== "student") forbid();

  if (requested) {
    const want = requested.trim().toLowerCase();
    const ownId    = session.userId.toLowerCase();
    const ownEmail = (session.email || "").toLowerCase();
    if (want !== ownId && want !== ownEmail) {
      // Older cookies (pre-hardening) carry no email — one store lookup
      // resolves it instead of logging every such student out.
      const { studentsStore } = await import("@/lib/students-store");
      const me = await studentsStore.byId(session.userId);
      const meEmail = (me?.email || "").toLowerCase();
      if (!me || (want !== me.id.toLowerCase() && want !== meEmail)) forbid();
    }
  }
  return session;
}

/** Same contract as requireStudentMatching, for parent-portal routes
 *  keyed by parentId. Admin passes; a parent may only act as themself. */
export async function requireParentMatching(requested?: string | null): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  if (session.role === "admin") return session;
  if (session.role !== "parent") forbid();
  if (requested && requested.trim() !== session.userId) forbid();
  return session;
}

/** True when `owner` (a stored studentId — historically sometimes an
 *  email) refers to the signed-in session's own student identity. */
export function sessionOwns(session: Session, owner: string | undefined | null): boolean {
  if (session.role === "admin") return true;
  if (!owner) return false;
  const o = owner.trim().toLowerCase();
  return o === session.userId.toLowerCase() || o === (session.email || "").toLowerCase();
}
