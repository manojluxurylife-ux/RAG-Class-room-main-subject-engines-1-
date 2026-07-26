import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { studyFirstSegmentSystemPrompt } from "@/lib/content-generators";
import { callGeminiWithImage } from "@/lib/teacher-prompts";
import { isValidSegments, STUDY_SUBJECTS } from "@/lib/study-material-schema";
import { uploadToGCS } from "@/lib/storage/gcs";
import { withApiErrorHandling } from "@/lib/api-error";
import { parseAiJson } from "@/lib/safe-json";
import { nanoid } from "nanoid";
import { requireStudent } from "@/lib/auth";

// Always live — hits Gemini + Firestore + GCS on every call.
export const dynamic = "force-dynamic";

// GET /api/student/study-materials?studentId=xxx — the student's own prepared materials
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/student/study-materials", async () => {
    const session = await requireStudent();
    const materials = await studyMaterialsStore.byStudent(session.userId);
    return NextResponse.json({ materials });
  });
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — a single textbook page photo/PDF page

// Roman-numeral class → numeric grade, matching the admin materials
// store's "grades" convention — same small mapping used elsewhere.
const CLASS_TO_GRADE: Record<string, string> = {
  V: "5", VI: "6", VII: "7", VIII: "8", IX: "9", X: "10", XI: "11", XII: "12",
};

/**
 * POST /api/student/study-materials
 * multipart/form-data: file, studentId, className, syllabus, subject,
 *                       sourceLanguage, targetLanguage
 *
 * STAGE 1 of progressive generation — generates and saves segment 1
 * ONLY, fast, and returns immediately with generationStatus: "partial".
 * The client is expected to call POST .../[id]/continue-generation
 * right after to fill in the rest while the student is already reading
 * segment 1. See lib/content-generators.ts's "Progressive Study
 * Material generation" section for the full reasoning (adopted the idea
 * from evaluating DeepTutor's Book engine, adapted for serverless).
 *
 * Auto-publish to the shared admin pool is deliberately NOT done here —
 * publishing a one-segment "course" would be a real, confusing bug for
 * every other matching student. That happens in continue-generation,
 * once the material is genuinely complete.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/study-materials", async () => {
    const requestId = req.headers.get("x-request-id") || nanoid(12);
    const form = await req.formData();
    const file           = form.get("file");
    const session = await requireStudent();
    const studentId       = session.userId;
    const className        = form.get("className")      as string;
    const syllabus          = form.get("syllabus")        as string;
    const subject            = form.get("subject")          as string;
    const sourceLanguage      = form.get("sourceLanguage")    as string;
    const targetLanguage       = form.get("targetLanguage")     as string;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    const required = { className, syllabus, subject, sourceLanguage, targetLanguage };
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing: ${missing.join(", ")}` }, { status: 400 });
    }
    if (!STUDY_SUBJECTS.includes(subject as any)) {
      return NextResponse.json({ error: "Unrecognized subject." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large — max 8 MB per page." }, { status: 413 });
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Use a JPG, PNG, or PDF page." }, { status: 415 });
    }

    const bytes  = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");

    const system = studyFirstSegmentSystemPrompt({ subject, className, syllabus, sourceLanguage, targetLanguage });
    const raw    = await callGeminiWithImage(
      system, "Prepare the first segment from this textbook page.", base64, file.type as any,
    );
    const parsed = parseAiJson(raw);

    if (!parsed?.firstSegment || !isValidSegments([parsed.firstSegment])) {
      return NextResponse.json({ error: "Could not understand this page. Try a clearer photo." }, { status: 502 });
    }

    const title = parsed.title || "Untitled";
    const roadmap: string[] = Array.isArray(parsed.roadmap) ? parsed.roadmap.filter((r: any) => typeof r === "string") : [];
    const firstSegment = { ...parsed.firstSegment, id: nanoid(8) };

    // Store the original textbook page image in GCS — students see it
    // alongside the generated segments while learning, and stage 2 needs
    // to re-read it too (the roadmap only has one-line descriptions, not
    // full detail — the actual teaching content still has to come from
    // the real page, not be invented from the short plan).
    let textbookImageRef: string | undefined;
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    textbookImageRef = `study-material-pages/${nanoid(10)}.${ext}`;
    try {
      await uploadToGCS(textbookImageRef, bytes, file.type, { ownerId: studentId, source: "study-material-upload" });
    } catch (error) {
      // The first segment remains usable, but continuation will clearly report storage configuration.
      console.error("[study-materials] source storage failed", error);
      textbookImageRef = undefined;
    }

    const material = await studyMaterialsStore.create({
      studentId,
      title, subject: subject as any,
      className, syllabus, sourceLanguage, targetLanguage,
      textbookImageRef,
      textbookMimeType: file.type,
      sourceText: typeof parsed.sourceText === "string" ? parsed.sourceText.slice(0, 30000) : undefined,
      sourceTopics: Array.isArray(parsed.sourceTopics) ? parsed.sourceTopics.filter((x: unknown) => typeof x === "string").slice(0, 30) : [],
      segments: [firstSegment],
      generationStatus: roadmap.length > 0 ? "partial" : "complete",
      processing: { stage: roadmap.length > 0 ? "continuation" : "complete", attempts: 1, startedAt: new Date().toISOString(), requestId },
      roadmap,
    });

    return NextResponse.json({ material, requestId }, { status: 201, headers: { "x-request-id": requestId } });
  });
}
