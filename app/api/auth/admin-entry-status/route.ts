import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEV_BYPASS_LOGIN } from "@/lib/dev-mode";
import { ADMIN_ENTRY_COOKIE, isValidAdminEntryProof } from "@/lib/admin-entry";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/admin-entry-status
 *
 * A cheap read-only check the persistent portal switcher calls once on
 * every page load, purely to decide whether to show itself. This is
 * NOT the security boundary — /api/auth/dev-bypass independently
 * re-verifies the proof on every actual portal switch. This just avoids
 * showing switch buttons to someone who was never verified in the
 * first place.
 */
export async function GET() {
  if (!DEV_BYPASS_LOGIN) {
    return NextResponse.json({ verified: false });
  }
  const proof = cookies().get(ADMIN_ENTRY_COOKIE)?.value;
  return NextResponse.json({ verified: isValidAdminEntryProof(proof) });
}
