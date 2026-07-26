import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { callGeminiWithImage, lessonSystemPrompt } from "@/lib/teacher-prompts";
import { parseAiJson } from "@/lib/safe-json";

const MAX_MB      = 15;
const ALLOWED     = ["image/jpeg","image/png","image/webp","application/pdf"];

/**
 * POST /api/textbook
 *
 * Accepts multipart/form-data:
 *   file        — JPEG/PNG/WEBP image (a single rasterised PDF page from PDFPagePicker)
 *                 OR a raw PDF (from the demo / direct upload path)
 *   grade       — "6"–"10"
 *   boardId     — "cbse" | "kerala" | "tamilnadu" | "karnataka"
 *   languageId  — "english" | "malayalam" | ...
 *   pageText    — (optional) raw text extracted from this page by pdfjs-dist on the client
 *   pageNumber  — (optional) which page was selected, for logging
 *   totalPages  — (optional) total pages in the original PDF, for logging
 *
 * Returns: { lesson: LessonJSON }
 */
export async function POST(req: Request) {
  // Signed-in users only — this endpoint spends the app's server-side
  // Gemini key (GEMINI_API_KEY); leaving it open lets anyone on the
  // internet drain the quota anonymously.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in to use this feature." }, { status: 401 });
  }

  const fd = await req.formData();

  const file       = fd.get("file")        as File   | null;
  const grade      = fd.get("grade")       as string || "8";
  const boardId    = fd.get("boardId")     as string || "cbse";
  const languageId = fd.get("languageId")  as string || "english";
  const pageText   = fd.get("pageText")    as string || "";
  const pageNumber = fd.get("pageNumber")  as string || "1";
  const totalPages = fd.get("totalPages")  as string || "1";

  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File too large — maximum ${MAX_MB} MB.` }, { status: 413 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Use JPG, PNG, WEBP, or PDF." }, { status: 415 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64      = Buffer.from(arrayBuffer).toString("base64");
  const mimeType    = file.type as "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

  // Build a richer text prompt when we have extracted page text.
  // This helps Claude identify equations that might be low-contrast in the scan.
  const textContext = pageText.trim()
    ? `\n\nExtracted text from this page (may contain OCR artefacts — use the image as ground truth):\n"""\n${pageText.slice(0, 3000)}\n"""`
    : "";

  const userPrompt = [
    `Please teach the maths on page ${pageNumber} of ${totalPages} from this textbook.`,
    textContext,
  ].join("");

  try {
    const system = lessonSystemPrompt({ grade, boardId, languageId, fromTextbook: true });
    const raw    = await callGeminiWithImage(system, userPrompt, base64, mimeType);
    const lesson = parseAiJson(raw);
    return NextResponse.json({ lesson });
  } catch (err) {
    console.error("[/api/textbook]", err);
    return NextResponse.json(
      { error: "Could not generate a lesson from this page. Try a clearer photo." },
      { status: 502 },
    );
  }
}
