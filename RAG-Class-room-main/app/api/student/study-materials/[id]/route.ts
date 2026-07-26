import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { signedDownloadUrl } from "@/lib/storage/gcs";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudent } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/student/study-materials/[id] — single material + a signed URL
// for the textbook page image (GCS objects aren't public, so the player
// needs a fresh signed link, not the raw object path).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("GET /api/student/study-materials/[id]", async () => {
    const session = await requireStudent();
    const material = await studyMaterialsStore.byId(params.id);
    if (!material || material.studentId !== session.userId) return NextResponse.json({ error: "Not found." }, { status: 404 });

    let textbookImageUrl: string | null = null;
    if (material.textbookImageRef) {
      try { textbookImageUrl = await signedDownloadUrl(material.textbookImageRef); }
      catch { textbookImageUrl = null; }
    }

    return NextResponse.json({ material, textbookImageUrl });
  });
}
