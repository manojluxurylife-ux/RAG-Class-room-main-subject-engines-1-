import { NextResponse } from "next/server";
import { parentLinksStore } from "@/lib/parent-links-store";
import { buildChildAnalytics } from "@/lib/child-analytics";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireParentMatching } from "@/lib/auth";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * GET /api/parent/child-analytics?parentId=xxx&studentId=yyy
 *
 * All 8 evaluation analytics — the computation itself lives in
 * lib/child-analytics.ts (shared with the student app's Parent's Corner
 * page, so both doors always show identical numbers).
 *
 * SECURITY: verifies parentId genuinely has a link to studentId before
 * returning anything — without this, any parent could view any
 * student's data just by guessing/passing a different studentId.
 */
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/parent/child-analytics", async () => {
    const { searchParams } = new URL(req.url);
    const parentId  = searchParams.get("parentId");
    const studentId = searchParams.get("studentId");
    if (!parentId || !studentId) {
      return NextResponse.json({ error: "parentId and studentId are required." }, { status: 400 });
    }
    await requireParentMatching(parentId);

    const link = await parentLinksStore.findLinkForParent(parentId, studentId);
    if (!link) {
      return NextResponse.json({ error: "This child isn't linked to your account." }, { status: 403 });
    }

    const analytics = await buildChildAnalytics(studentId);
    if (!analytics) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    return NextResponse.json(analytics);
  });
}
