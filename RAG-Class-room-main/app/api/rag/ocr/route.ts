import { NextResponse } from "next/server";
import { callGeminiWithImage } from "@/lib/teacher-prompts";
import { parseAiJson } from "@/lib/safe-json";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudent } from "@/lib/auth";

export const dynamic = "force-dynamic";
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/rag/ocr", async () => {
    // Removed requirement: await requireStudent();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf") {
      return NextResponse.json({ error: "Upload a PDF." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "PDF too large for OCR fallback (20 MB maximum)." }, { status: 413 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const prompt = `Perform faithful OCR on this textbook PDF. Preserve page boundaries, headings, formulas and native-script text. Do not summarize or add facts. Return ONLY JSON: {"pages":[{"page":1,"text":"..."}]}. Include every readable page; use an empty string only when a page is truly unreadable.`;
    const raw = await callGeminiWithImage(prompt, "Transcribe this PDF page by page.", bytes.toString("base64"), "application/pdf");
    const parsed = parseAiJson(raw);
    const pages = Array.isArray(parsed?.pages)
      ? parsed.pages.map((p: any, i: number) => ({ page: Number(p?.page) || i + 1, text: String(p?.text || "").slice(0, 200000) }))
      : [];
    if (!pages.some((p: any) => p.text.trim())) {
      return NextResponse.json({ error: "OCR could not read this PDF." }, { status: 422 });
    }
    return NextResponse.json({ pages, engine: "gemini-document-ocr" });
  });
}
