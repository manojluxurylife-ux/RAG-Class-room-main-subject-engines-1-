import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { isValidSegments, STUDY_SUBJECTS } from "@/lib/study-material-schema";
import { uploadToGCS } from "@/lib/storage/gcs";
import { withApiErrorHandling } from "@/lib/api-error";
import { nanoid } from "nanoid";
import { requireStudent } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const CLASS_TO_GRADE: Record<string, string> = {
  V: "5", VI: "6", VII: "7", VIII: "8", IX: "9", X: "10", XI: "11", XII: "12",
};

/**
 * POST /api/student/study-materials/from-local
 *
 * The local-fallback counterpart to POST /api/student/study-materials —
 * same validation, same storage shape, same response contract, but the
 * segment content was already generated CLIENT-SIDE (see
 * lib/client/local-material-fallback.ts: Qwen3.5 vision → VibeThinker →
 * Qwen3.5 translate, all running in the student's browser) instead of
 * by a server-side Gemini call. This route's only job is validating
 * that client-generated content the same way the Gemini path's output
 * gets validated, storing the original textbook image the same way,
 * and saving the record — it never calls any AI model itself.
 *
 * Always saved as generationStatus: "complete" with an empty roadmap —
 * there is no local equivalent of the multi-segment continuation flow
 * (that still needs Gemini), so a locally-generated material is always
 * exactly one segment, and is never eligible for shared-library
 * auto-publish (that path is gated on continue-generation's QA step,
 * which this bypasses entirely — a single AI-generated-content-review
 * gate for what actually reaches other students, not two).
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/study-materials/from-local", async () => {
    const session = await requireStudent();
    const form = await req.formData();

    const file          = form.get("file");
    const className      = form.get("className")      as string;
    const syllabus        = form.get("syllabus")        as string;
    const subject          = form.get("subject")          as string;
    const sourceLanguage  = form.get("sourceLanguage")  as string;
    const targetLanguage   = form.get("targetLanguage")   as string;
    const title             = (form.get("title")             as string) || "Untitled";
    const firstSegmentRaw = form.get("firstSegment")   as string;

    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    const required = { className, syllabus, subject, sourceLanguage, targetLanguage, firstSegmentRaw };
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) return NextResponse.json({ error: `Missing: ${missing.join(", ")}` }, { status: 400 });
    if (!STUDY_SUBJECTS.includes(subject as any)) return NextResponse.json({ error: "Unrecognized subject." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large — max 8 MB per page." }, { status: 413 });
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) return NextResponse.json({ error: "Use a JPG, PNG, or PDF page." }, { status: 415 });

    let firstSegmentParsed: any;
    try { firstSegmentParsed = JSON.parse(firstSegmentRaw); }
    catch { return NextResponse.json({ error: "Malformed segment data." }, { status: 400 }); }

    // Same validator the Gemini path uses — a locally-generated segment
    // has to pass the exact same structural bar as a Gemini one.
    if (!isValidSegments([firstSegmentParsed])) {
      return NextResponse.json({ error: "The locally-generated segment didn't pass validation. Try again." }, { status: 422 });
    }
    const firstSegment = { ...firstSegmentParsed, id: nanoid(8) };

    const bytes  = Buffer.from(await file.arrayBuffer());
    let textbookImageRef: string | undefined;
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    textbookImageRef = `study-material-pages/${nanoid(10)}.${ext}`;
    try {
      await uploadToGCS(textbookImageRef, bytes, file.type, { ownerId: session.userId, source: "study-material-upload-local" });
    } catch (error) {
      console.error("[study-materials/from-local] source storage failed", error);
      textbookImageRef = undefined;
    }

    const material = await studyMaterialsStore.create({
      studentId: session.userId,
      title, subject: subject as any,
      className, syllabus, sourceLanguage, targetLanguage,
      textbookImageRef,
      textbookMimeType: file.type,
      segments: [firstSegment],
      generatedBy: "local",
      generationStatus: "complete",
      processing: { stage: "complete", attempts: 1, startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
      roadmap: [],
    });

    return NextResponse.json({ material }, { status: 201 });
  });
}
