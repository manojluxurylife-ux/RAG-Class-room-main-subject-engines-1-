import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { materialsStore } from "@/lib/materials-store";
import { segmentsToMarkdown } from "@/lib/study-material-schema";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudent } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CLASS_TO_GRADE: Record<string, string> = {
  V: "5", VI: "6", VII: "7", VIII: "8", IX: "9", X: "10", XI: "11", XII: "12",
};

/**
 * POST /api/student/study-materials/[id]/share
 *
 * The explicit-consent replacement for what continue-generation used
 * to do automatically the moment a material passed QA — see that
 * route's comments. This is the ONE place a student's private material
 * actually becomes visible to other students, and it only runs when
 * the student themselves calls it, after being asked "share this with
 * other students?" (see the study-materials page's prompt). No
 * automatic path to this exists anywhere else in the app.
 *
 * Still gated on the same bar as before: generationStatus "complete"
 * and a passing QA report — a student can't share something that
 * failed the AI-content-quality check just because they said yes, and
 * can't share something still mid-generation.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("POST /api/student/study-materials/[id]/share", async () => {
    const session = await requireStudent();
    const material = await studyMaterialsStore.byId(params.id);
    if (!material || material.studentId !== session.userId) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (material.publishedMaterialId) {
      return NextResponse.json({ material }); // already shared — idempotent, not an error
    }
    if (material.generationStatus !== "complete") {
      return NextResponse.json({ error: "This material is still being prepared — try again once it's finished." }, { status: 409 });
    }
    if (material.qaReport?.status !== "passed") {
      return NextResponse.json({ error: "This material didn't pass the automatic quality check, so it can't be shared with other students. It's still yours to use." }, { status: 422 });
    }

    const grade = CLASS_TO_GRADE[material.className] || material.className;
    const published = await materialsStore.add({
      title: material.title, subject: material.subject,
      description: `QA verified (${material.qaReport.overallScore}%) · Shared by a Class ${material.className} student`,
      boards: [material.syllabus], grades: [grade], languages: [material.targetLanguage],
      fileType: "text", source: "generated",
      sourceRef: "",
      content: segmentsToMarkdown(material.title, material.segments),
      materialKind: "revision-notes",
      sizeBytes: 0,
      published: true,
      addedBy: `student:${material.studentId}`,
      sourceStudyMaterialId: material.id,
      textbookImageRef: material.textbookImageRef,
    });
    const marked = await studyMaterialsStore.markPublished(params.id, published.id);
    return NextResponse.json({ material: marked || material });
  });
}
