import { NextResponse } from "next/server";
import { examPatternExtractionSystemPrompt } from "@/lib/content-generators";
import { extractPatternFromPdf } from "@/lib/exam-patterns";
import { callGeminiWithImage } from "@/lib/teacher-prompts";
import { parseAiJson } from "@/lib/safe-json";
import { withApiErrorHandling } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // a multi-page sample paper PDF, larger than a single textbook photo

/**
 * POST /api/admin/exam-patterns/extract
 * multipart/form-data: file (a real, official sample paper PDF)
 *
 * Extracts a DRAFT ExamPattern directly from a real uploaded document —
 * see lib/content-generators.ts's examPatternExtractionSystemPrompt for
 * the full reasoning (adopted from evaluating DeepTutor's exam-mimic
 * system, Apache 2.0). Never returns something already treated as
 * final — the response includes any section-marks mismatches found by
 * cross-checking the AI's own numbers against each other, so a
 * misreading surfaces immediately rather than silently passing through.
 *
 * Shares its core extraction logic with the student-facing "upload
 * your own paper" flow (lib/exam-patterns.ts's extractPatternFromPdf) —
 * one implementation, not two copies that could drift apart.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/admin/exam-patterns/extract", async () => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Upload a PDF of the real sample paper." }, { status: 415 });
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
