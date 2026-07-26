import { NextResponse } from "next/server";
import { examPatternExtractionSystemPrompt } from "@/lib/content-generators";
import { extractPatternFromPdf } from "@/lib/exam-patterns";
import { callGeminiWithImage } from "@/lib/teacher-prompts";
import { parseAiJson } from "@/lib/safe-json";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";

export const dynamic = "force-dynamic";
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST /api/student/exam-room/extract-pdf
 * multipart/form-data: file (any real sample/previous-year paper PDF the student has)
 *
 * The scalable answer to "Exam Room only covers one pattern" — instead
 * of admin-curating a fixed library for every class/subject/board (real,
 * ongoing, slow work), a student brings their OWN real paper for
 * whatever they're actually studying, and this extracts its structure
 * directly. Works for any class, any subject, any board immediately —
 * no pre-built pattern needed at all.
 *
 * Shares its extraction logic with the admin curation tool
 * (lib/exam-patterns.ts's extractPatternFromPdf) — same underlying
 * technology, different purpose: the admin's version builds a shared,
 * reviewed library; this is a student's own one-off practice paper,
 * shown to THEM to confirm before generating, never published anywhere.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/exam-room/extract-pdf", async () => {
    await requireStudentMatching();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Upload a PDF of your sample or previous-year paper." }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large — max 15 MB." }, { status: 413 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");

    const { draft, mismatches, error } = await extractPatternFromPdf(base64, callGeminiWithImage, parseAiJson, examPatternExtractionSystemPrompt);
    if (!draft) return NextResponse.json({ error }, { status: 502 });

    return NextResponse.json({ draft, mismatches });
  });
}
