import { NextResponse } from "next/server";
import { parentLinksStore } from "@/lib/parent-links-store";
import { studentsStore } from "@/lib/students-store";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireParentMatching } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/parent/children?parentId=xxx
// Real linked children, with a light activity summary per child for the
// dashboard list — full analytics live in /api/parent/child-analytics,
// this stays cheap since it's loaded on every dashboard visit.
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/parent/children", async () => {
    const parentId = new URL(req.url).searchParams.get("parentId");
    if (!parentId) return NextResponse.json({ error: "parentId is required." }, { status: 400 });
    await requireParentMatching(parentId);

    const links = await parentLinksStore.byParent(parentId);
    const children = await Promise.all(links.map(async (link) => {
      const student = await studentsStore.byId(link.studentId);
      if (!student) return null;
      const materials = await studyMaterialsStore.byStudent(student.id);
      const totalSegments = materials.reduce((s, m) => s + m.segments.length, 0);
      const completedSegments = materials.reduce((s, m) => s + m.progress.completedSegmentIds.length, 0);
      return {
        id: student.id, name: student.name, className: student.className,
        syllabus: student.syllabus, languageId: student.languageId,
        lastActiveAt: student.lastActiveAt,
        materialsCount: materials.length,
        overallCompletionPct: totalSegments > 0 ? Math.round((completedSegments / totalSegments) * 100) : 0,
      };
    }));

    return NextResponse.json({ children: children.filter(Boolean) });
  });
}
