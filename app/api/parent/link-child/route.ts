import { NextResponse } from "next/server";
import { studentsStore } from "@/lib/students-store";
import { parentLinksStore } from "@/lib/parent-links-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireParentMatching } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/parent/link-child
 * body: { parentId, childEmail }
 *
 * Links a parent account to a real, existing student account by the
 * child's own login email. This is the piece that made the whole parent
 * portal fake before — there was no mechanism connecting a parent to
 * any actual student data at all.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/parent/link-child", async () => {
    const { parentId, childEmail } = await req.json();
    if (!parentId || !childEmail) {
      return NextResponse.json({ error: "parentId and childEmail are required." }, { status: 400 });
    }
    await requireParentMatching(parentId);

    const child = await studentsStore.byEmail(childEmail);
    if (!child) {
      return NextResponse.json({ error: "No student account found with that email. Double-check it matches exactly what your child uses to log in." }, { status: 404 });
    }

    const alreadyLinked = await parentLinksStore.linkExists(parentId, child.id);
    if (alreadyLinked) {
      return NextResponse.json({ error: "You've already linked this child." }, { status: 409 });
    }

    const link = await parentLinksStore.create({
      parentId, studentId: child.id, studentEmail: child.email, studentName: child.name,
    });
    return NextResponse.json({ link }, { status: 201 });
  });
}
