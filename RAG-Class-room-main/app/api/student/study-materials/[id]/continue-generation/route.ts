import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { studyRemainingSegmentsSystemPrompt } from "@/lib/content-generators";
import { callGeminiWithImage } from "@/lib/teacher-prompts";
import { isValidSegments } from "@/lib/study-material-schema";
import { downloadFromGCS } from "@/lib/storage/gcs";
import { withApiErrorHandling } from "@/lib/api-error";
import { parseAiJson } from "@/lib/safe-json";
import { nanoid } from "nanoid";
import { evaluateStudyMaterial } from "@/lib/study-material-qa";
import { requireStudent } from "@/lib/auth";

export const dynamic = "force-dynamic";


/**
 * POST /api/student/study-materials/[id]/continue-generation
 *
 * STAGE 2 of progressive generation — called by the client immediately
 * after stage 1 returns, while the student is already reading segment 1.
 * Generates the remaining segments using the roadmap for continuity,
 * appends them, and marks the material complete.
 *
 * Also the ONE place auto-publish to the shared admin pool happens —
 * deliberately not in stage 1, since publishing a one-segment "course"
 * would be a real bug for other students. Handles both real cases in
 * one path: if there's genuinely a roadmap to fill in, generates and
 * appends those segments; if the material was already complete from
 * stage 1 (the AI decided the whole page only needed one segment),
 * skips generation entirely and just publishes — one canonical place
 * this happens, not duplicated across two routes.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("POST /api/student/study-materials/[id]/continue-generation", async () => {
    const session = await requireStudent();
    const material = await studyMaterialsStore.byId(params.id);
    if (!material || material.studentId !== session.userId) return NextResponse.json({ error: "Not found." }, { status: 404 });

    let updated = material;
    const attempts = (material.processing?.attempts || 0) + 1;
    await studyMaterialsStore.updateProcessing(params.id, { stage: "continuation", attempts, startedAt: material.processing?.startedAt || new Date().toISOString(), requestId: material.processing?.requestId });

    if (material.generationStatus === "partial" && material.roadmap?.length) {
      if (!material.textbookImageRef) {
        return NextResponse.json({ error: "The original page image isn't available to continue generating this material." }, { status: 422 });
      }
      const { bytes, contentType } = await downloadFromGCS(material.textbookImageRef);
      const base64 = bytes.toString("base64");
      const mimeType = (material.textbookMimeType || contentType || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

      const system = studyRemainingSegmentsSystemPrompt({
        subject: material.subject, className: material.className, syllabus: material.syllabus,
        sourceLanguage: material.sourceLanguage, targetLanguage: material.targetLanguage,
        firstSegmentHeading: material.segments[0]?.heading || "", roadmap: material.roadmap,
      });
      const raw = await callGeminiWithImage(
        system, "Generate the remaining segments now.", base64, mimeType as any,
      );
      const parsed = parseAiJson(raw);

      if (!isValidSegments(parsed.segments)) {
        await studyMaterialsStore.updateProcessing(params.id, { stage: "failed", attempts, startedAt: material.processing?.startedAt, lastError: "Gemini returned invalid continuation segments.", requestId: material.processing?.requestId });
        return NextResponse.json({ error: "Could not generate the remaining segments. The first segment is still available." }, { status: 502 });
      }

      const newSegments = parsed.segments.map((s: any) => ({ ...s, id: nanoid(8) }));
      const appended = await studyMaterialsStore.appendSegments(params.id, newSegments);
      if (!appended) return NextResponse.json({ error: "Not found." }, { status: 404 });
      updated = appended;
    }

    // Run the integrated QA gate before any shared publication. The
    // student's private material remains available even when QA fails;
    // only shared-library publication is blocked pending admin review.
    if (updated.generationStatus === "complete" && !updated.qaReport) {
      await studyMaterialsStore.updateProcessing(params.id, { stage: "qa", attempts, startedAt: material.processing?.startedAt, requestId: material.processing?.requestId });
      const qaReport = evaluateStudyMaterial(updated);
      const checked = await studyMaterialsStore.saveQaReport(params.id, qaReport);
      if (checked) updated = checked;
    }

    // NOTE: this used to auto-publish to the shared library right here,
    // the moment QA passed, with no student involvement at all. Changed
    // deliberately: a student's own generated material is THEIRS, and
    // publishing it for every other student to see without asking
    // first isn't something this app should do silently on their
    // behalf. QA passing now just makes the material ELIGIBLE to
    // share — see POST .../[id]/share, which the student triggers
    // explicitly after being asked "share this with other students?".
    // qaReport.status === "passed" is what the UI checks to decide
    // whether to show that prompt at all.

    await studyMaterialsStore.updateProcessing(params.id, { stage: "complete", attempts, startedAt: material.processing?.startedAt, completedAt: new Date().toISOString(), requestId: material.processing?.requestId });
    const fresh = await studyMaterialsStore.byId(params.id);
    return NextResponse.json({ material: fresh || updated });
  });
}
