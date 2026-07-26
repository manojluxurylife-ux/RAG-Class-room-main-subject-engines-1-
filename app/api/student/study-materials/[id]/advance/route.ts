import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudent } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/student/study-materials/[id]/advance
// body: { segmentId }   — linear, gated: called when a segment is finished
//                         (no quiz, or quiz answered correctly). Unlocks
//                         the next segment.
// body: { targetIndex } — free navigation (quiz gating turned off in
//                         Settings): student jumped straight to a further
//                         segment. Records the furthest reached position
//                         for resume, without marking any quiz as passed.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("POST /api/student/study-materials/[id]/advance", async () => {
    const session = await requireStudent();
    const owned = await studyMaterialsStore.byId(params.id);
    if (!owned || owned.studentId !== session.userId) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const body = await req.json();
    const { segmentId, targetIndex } = body;

    if (typeof targetIndex === "number") {
      const material = await studyMaterialsStore.jumpTo(params.id, targetIndex);
      if (!material) return NextResponse.json({ error: "Not found." }, { status: 404 });
      return NextResponse.json({ material });
    }

    if (!segmentId) return NextResponse.json({ error: "segmentId or targetIndex is required." }, { status: 400 });
    const material = await studyMaterialsStore.advance(params.id, segmentId);
    if (!material) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ material });
  });
}
