import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { buildSystemPrompt, defaultTitle, type MaterialKind } from "@/lib/content-generators";
import { callGeminiWithImage } from "@/lib/teacher-prompts";
import { downloadFromGCS } from "@/lib/storage/gcs";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudent } from "@/lib/auth";
import type { ExtraMaterialKind } from "@/lib/study-material-schema";

export const dynamic = "force-dynamic";

// Roman-numeral class → numeric grade, same mapping used at signup —
// duplicated here (small, stable) rather than importing a client module
// into a server route.
const CLASS_TO_GRADE: Record<string, string> = {
  V: "5", VI: "6", VII: "7", VIII: "8", IX: "9", X: "10", XI: "11", XII: "12",
};

// Which Creator Studio MaterialKind each student-facing "extra" maps to —
// reuses the exact same generator logic Creator Studio uses for admin-
// authored materials, just fed the student's own uploaded page instead
// of a typed topic.
const EXTRA_TO_KIND: Record<ExtraMaterialKind, MaterialKind> = {
  flashcards: "flashcards",
  quiz:       "quiz",
  notes:      "revision-notes",
  mindmap:    "mind-map",
};

/**
 * POST /api/student/study-materials/[id]/generate-extra
 * body: { kind: "flashcards" | "quiz" | "notes" | "mindmap" }
 *
 * The student-facing "grid of generators" — after uploading one page in
 * the Kitchen, they can request additional artifacts from that SAME page
 * without uploading it again. Re-downloads the already-uploaded image
 * from GCS and reuses Creator Studio's exact generator prompts
 * (buildSystemPrompt), just with sourceIsImage: true so the phrasing
 * reads naturally and the AI is told to identify the topic from the
 * image itself rather than being given a typed topic string.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("POST /api/student/study-materials/[id]/generate-extra", async () => {
    const { kind } = await req.json();
    const extraKind = kind as ExtraMaterialKind;
    if (!EXTRA_TO_KIND[extraKind]) {
      return NextResponse.json({ error: "kind must be one of: flashcards, quiz, notes, mindmap." }, { status: 400 });
    }

    const session = await requireStudent();
    const material = await studyMaterialsStore.byId(params.id);
    if (!material || material.studentId !== session.userId) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!material.textbookImageRef) {
      return NextResponse.json(
        { error: "The original page image isn't available for this material (it may have been uploaded before this feature, or as a PDF page without image storage)." },
        { status: 422 },
      );
    }

    const { bytes, contentType } = await downloadFromGCS(material.textbookImageRef);
    const base64 = bytes.toString("base64");
    const mimeType = (contentType === "image/png" ? "image/png" : "image/jpeg") as "image/jpeg" | "image/png";

    const materialKind = EXTRA_TO_KIND[extraKind];
    const system = buildSystemPrompt(materialKind, {
      topic: "", // unused when sourceIsImage is true — the AI identifies the topic from the page itself
      subject: material.subject,
      grade: CLASS_TO_GRADE[material.className] || material.className,
      boardId: material.syllabus,
      languageId: material.targetLanguage,
      sourceIsImage: true,
    });

    const content = await callGeminiWithImage(
      system, `Generate the ${materialKind.replace("-", " ")} from this textbook page now.`, base64, mimeType,
    );

    const updated = await studyMaterialsStore.saveExtra(params.id, extraKind, content.trim());
    return NextResponse.json({ material: updated });
  });
}
