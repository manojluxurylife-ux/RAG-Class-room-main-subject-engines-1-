import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { withApiErrorHandling } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrorHandling("GET /api/admin/material-qa", async () => {
    const materials = (await studyMaterialsStore.all())
      .filter(m => m.generationStatus === "complete")
      .sort((a, b) => new Date(b.qaReport?.checkedAt || b.updatedAt).getTime() - new Date(a.qaReport?.checkedAt || a.updatedAt).getTime());
    return NextResponse.json({ materials });
  });
}
