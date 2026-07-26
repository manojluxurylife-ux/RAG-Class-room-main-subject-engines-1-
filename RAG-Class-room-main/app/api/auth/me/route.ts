import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — the current session's role/userId/name.
 *
 * The session cookie is httpOnly (correctly, for security), so client
 * components can't read it directly — this small endpoint is how a
 * client component finds out "who am I" server-side without needing a
 * parallel localStorage session (which is what the student side uses,
 * but parent/admin/school never had an equivalent).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ session: null });
  return NextResponse.json({ session });
}
