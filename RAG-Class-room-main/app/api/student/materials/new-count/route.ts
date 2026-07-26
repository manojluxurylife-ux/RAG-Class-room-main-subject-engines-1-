import { NextResponse } from "next/server";
import { materialsStore } from "@/lib/materials-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireAnySession } from "@/lib/auth";

// Always live — this powers a real-time notification badge.
export const dynamic = "force-dynamic";

/**
 * GET /api/student/materials/new-count?board=X&grade=Y&subjects=A,B&since=ISO
 *
 * A deliberately lightweight, dedicated endpoint — the dashboard and
 * every page's nav both need this on load, and neither should have to
 * fetch the full materials list (with all its content/metadata) just to
 * show a small number on a badge.
 */
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/student/materials/new-count", async () => {
    await requireAnySession();
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get("board") || "";
    const grade   = searchParams.get("grade") || "";
    const since   = searchParams.get("since") || new Date(0).toISOString(); // no "since" → count everything ever published
    const language = searchParams.get("language") || undefined;
    const subjectsParam = searchParams.get("subjects");
    const subjects = subjectsParam ? subjectsParam.split(",").filter(Boolean) : undefined;

    const count = await materialsStore.newCountForStudent(boardId, grade, subjects, since, language);
    return NextResponse.json({ count });
  });
}
