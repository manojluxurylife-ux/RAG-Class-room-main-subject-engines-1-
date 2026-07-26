import { NextResponse } from "next/server";
import { callGemini } from "@/lib/teacher-prompts";
import { parseAiJson } from "@/lib/safe-json";
import { slideDeckSystemPrompt } from "@/lib/content-generators";
import { isValidSlideDeck } from "@/lib/slide-schema";
import { buildPptxBuffer } from "@/lib/pptx-render";
import { persistMaterialFile } from "@/lib/storage/persist-material";
import { nanoid } from "nanoid";

// Always live — this hits Gemini (and, best-effort, storage) on every call, never prerendered.
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/generate-slides
 * body: { topic, subject, grade, boardId, languageId }
 *
 * Generates a structured SlideDeck via Gemini, builds a real .pptx from
 * it (lib/pptx-render.ts — native vector shapes, no image generation),
 * and tries to persist the file via lib/storage/persist-material.ts
 * (GCS → admin Google Drive → give up on saving, in that order).
 *
 * IMPORTANT: generation must succeed even if none of those storage
 * backends are configured — a slide deck with nowhere to be archived is
 * still a slide deck the admin can preview and download. This route used
 * to call uploadToGCS directly and let a storage failure 502 the whole
 * request; that's exactly the failure mode being avoided here.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { topic, subject = "Maths", grade = "8", boardId = "cbse", languageId = "english" } = body;

  if (!topic?.trim()) {
    return NextResponse.json({ error: "Missing 'topic'." }, { status: 400 });
  }

  try {
    const system = slideDeckSystemPrompt({ topic, subject, grade, boardId, languageId });
    const raw = await callGemini(system, `Design the slide deck now.`);
    const deck = parseAiJson(raw);

    if (!isValidSlideDeck(deck)) {
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 });
    }

    const pptxBuffer = await buildPptxBuffer(deck);
    const objectName = `generated-slides/${nanoid(10)}.pptx`;
    const stored = await persistMaterialFile(
      objectName,
      pptxBuffer,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );

    return NextResponse.json({
      deck,
      sizeBytes: pptxBuffer.length,
      // gcsObjectName kept for the existing "Publish" step (only
      // meaningful when backend is "gcs-or-db"); admin-side UI should
      // check `stored.persisted` before offering Publish, and fall back
      // to a plain download of the deck when it's false.
      gcsObjectName: stored.backend === "gcs-or-db" ? stored.objectName : undefined,
      driveFileId: stored.driveFileId,
      driveViewLink: stored.driveViewLink,
      storageBackend: stored.backend,
      storageWarning: stored.warning,
    });
  } catch (err: any) {
    console.error("[/api/admin/generate-slides]", err.message);
    return NextResponse.json({ error: "Could not generate the slide deck. Please try again." }, { status: 502 });
  }
}
