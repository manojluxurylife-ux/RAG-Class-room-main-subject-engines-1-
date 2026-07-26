import { NextResponse } from "next/server";
import { materialsStore } from "@/lib/materials-store";
import { signedDownloadUrl } from "@/lib/storage/gcs";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireAnySession } from "@/lib/auth";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// GET /api/student/materials?board=kerala&grade=8&subjects=Maths,Science&language=tamil
// Returns published materials filtered to the student's board + grade +
// language/medium, and optionally their subject preferences (Settings).
// subjects is a comma-separated list; omitted or empty means no filter
// on that dimension.
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/student/materials", async () => {
    await requireAnySession();
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get("board") || "";
    const grade   = searchParams.get("grade") || "";
    const language = searchParams.get("language") || undefined;
    const subjectsParam = searchParams.get("subjects");
    const subjects = subjectsParam ? subjectsParam.split(",").filter(Boolean) : undefined;
    const materials = await materialsStore.forStudent(boardId, grade, subjects, language);

    // Signed preview URLs for anything with a stored textbook page image
    // — lets a student visually confirm a shared material is really from
    // their own textbook before choosing to download it, not just trust
    // a title match. Best-effort per item: a signing failure for one
    // material shouldn't break the rest of the list.
    const withPreviews = await Promise.all(materials.map(async (m) => {
      if (!m.textbookImageRef) return m;
      try {
        const textbookPreviewUrl = await signedDownloadUrl(m.textbookImageRef);
        return { ...m, textbookPreviewUrl };
      } catch {
        return m;
      }
    }));

    return NextResponse.json({ materials: withPreviews });
  });
}
