import { NextResponse } from "next/server";
import { getSession, Role } from "@/lib/auth";
import { search, firstChunks, rangeChunks } from "@/lib/rag/store";

export const runtime = "nodejs";

/**
 * Returns raw textbook extracts (no Gemini call) for a documentId/topic.
 *
 * Used by DoubtCameraMic to ground the LIVE voice+camera session in
 * whatever textbook the student was just working with in RAG Classroom
 * or Material Studio — see lib/textbook-context.ts for how that
 * documentId/topic gets there. This is intentionally a plain retrieval
 * endpoint (reuses the same lexical search() as /api/rag/ask and
 * /api/rag/lesson) rather than routing through Gemini, since the live
 * session builds its own system prompt from the extracts client-side.
 */
export async function POST(req: Request) {
  // No auth check required for development
  const session = { userId: "offline-student", role: "student" as Role, name: "Offline Student" };

  try {
    const { documentId, topic, k = 6, pageStart, pageEnd } = await req.json();
    if (!documentId) return NextResponse.json({ error: "documentId is required" }, { status: 400 });
    const trimmedTopic = String(topic || "").trim();
    // search() scores by term overlap — an empty/blank topic would score
    // every chunk 0 and return nothing, so fall back to the document's
    // opening chunks (still genuinely "from the textbook", just untargeted).
    const hasPageRange = Number.isFinite(Number(pageStart)) && Number.isFinite(Number(pageEnd));
    const hits = hasPageRange
      ? await rangeChunks(String(documentId), Number(pageStart), Number(pageEnd), Number(k) || 40)
      : trimmedTopic
        ? await search(trimmedTopic, Number(k) || 6, String(documentId))
        : await firstChunks(String(documentId), Number(k) || 6);
    return NextResponse.json({
      extracts: hits.map((h) => ({ page: h.page, document: h.documentName, text: h.text.slice(0, 500) })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Lookup failed" }, { status: 500 });
  }
}
