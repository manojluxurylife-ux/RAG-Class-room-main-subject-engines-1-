import { NextResponse } from "next/server";
import { materialsStore } from "@/lib/materials-store";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/study-materials/import
 * body: { materialId, studentId, className }
 *
 * "Download" for a student-contributed shared material means something
 * more useful than a plain file: it copies the REAL structured segments
 * (points, worked examples, quizzes with correct answers and Bloom's
 * tagging, diagrams) from the original student's material into a fresh
 * personal copy for the downloading student — with its own fresh
 * progress (starts at segment 1, nothing completed yet), so it shows up
 * and works correctly in their own Classroom exactly like something
 * they'd generated themselves, but without spending an AI call.
 *
 * Only possible for materials that carry a `sourceStudyMaterialId` —
 * i.e. ones that came from a student's Study Materials upload, not
 * admin-uploaded PDFs/files, which have no structured segments to copy.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/study-materials/import", async () => {
    const { materialId, studentId, className } = await req.json();
    if (!materialId || !studentId) {
      return NextResponse.json({ error: "materialId and studentId are required." }, { status: 400 });
    }
    await requireStudentMatching(studentId);

    const sharedMaterial = await materialsStore.byId(materialId);
    if (!sharedMaterial) return NextResponse.json({ error: "Material not found." }, { status: 404 });
    if (!sharedMaterial.sourceStudyMaterialId) {
      return NextResponse.json(
        { error: "This material doesn't have an importable source — use the regular download instead." },
        { status: 422 },
      );
    }

    const original = await studyMaterialsStore.byId(sharedMaterial.sourceStudyMaterialId);
    if (!original) {
      return NextResponse.json({ error: "The original material this was shared from no longer exists." }, { status: 404 });
    }

    // Fresh personal copy — same content, new owner, new progress.
    const imported = await studyMaterialsStore.create({
      studentId,
      title: original.title,
      subject: original.subject,
      className: className || original.className,
      syllabus: original.syllabus,
      sourceLanguage: original.sourceLanguage,
      targetLanguage: original.targetLanguage,
      textbookImageRef: original.textbookImageRef, // same GCS object — no re-upload needed, signed URLs are generated fresh per-request regardless of who's viewing
      segments: original.segments,
    });

    return NextResponse.json({ material: imported }, { status: 201 });
  });
}
