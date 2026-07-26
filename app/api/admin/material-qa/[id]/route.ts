import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { materialsStore } from "@/lib/materials-store";
import { evaluateStudyMaterial } from "@/lib/study-material-qa";
import { segmentsToMarkdown } from "@/lib/study-material-schema";
import { withApiErrorHandling } from "@/lib/api-error";

export const dynamic = "force-dynamic";
const CLASS_TO_GRADE: Record<string, string> = { V:"5", VI:"6", VII:"7", VIII:"8", IX:"9", X:"10", XI:"11", XII:"12" };

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("POST /api/admin/material-qa/[id]", async () => {
    const material = await studyMaterialsStore.byId(params.id);
    if (!material) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const body = await req.json();
    const action = body.action as "rerun" | "approve" | "reject";

    if (action === "rerun") {
      const updated = await studyMaterialsStore.saveQaReport(params.id, evaluateStudyMaterial(material));
      return NextResponse.json({ material: updated });
    }

    if (action === "reject") {
      const now = new Date().toISOString();
      const report = material.qaReport || evaluateStudyMaterial(material);
      const updated = await studyMaterialsStore.saveQaReport(params.id, {
        ...report, status: "rejected", rejectedAt: now, rejectedBy: "admin", rejectionReason: String(body.reason || "Rejected during admin review"),
      });
      return NextResponse.json({ material: updated });
    }

    if (action === "approve") {
      let updated = material;
      const now = new Date().toISOString();
      const report = material.qaReport || evaluateStudyMaterial(material);
      const approved = await studyMaterialsStore.saveQaReport(params.id, { ...report, status: "approved", approvedAt: now, approvedBy: "admin" });
      if (approved) updated = approved;

      if (!updated.publishedMaterialId) {
        const grade = CLASS_TO_GRADE[updated.className] || updated.className;
        const published = await materialsStore.add({
          title: updated.title, subject: updated.subject,
          description: `Admin QA approved (${updated.qaReport?.overallScore ?? 0}%) · Class ${updated.className}`,
          boards: [updated.syllabus], grades: [grade], languages: [updated.targetLanguage],
          fileType: "text", source: "generated", sourceRef: "",
          content: segmentsToMarkdown(updated.title, updated.segments), materialKind: "revision-notes",
          sizeBytes: 0, published: true, addedBy: "admin:qa-review",
          sourceStudyMaterialId: updated.id, textbookImageRef: updated.textbookImageRef,
        });
        const marked = await studyMaterialsStore.markPublished(params.id, published.id);
        if (marked) updated = marked;
      }
      return NextResponse.json({ material: updated });
    }

    return NextResponse.json({ error: "action must be rerun, approve, or reject." }, { status: 400 });
  });
}
