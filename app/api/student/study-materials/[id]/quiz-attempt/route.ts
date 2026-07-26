import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudent } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/student/study-materials/[id]/quiz-attempt
// body: { segmentId, segmentHeading, question, correct }
// Records every quiz attempt — right or wrong — for the /progress
// page's test-results view. Separate from /advance, which only fires on
// a successful (gated) completion.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("POST /api/student/study-materials/[id]/quiz-attempt", async () => {
    const session = await requireStudent();
    const owned = await studyMaterialsStore.byId(params.id);
    if (!owned || owned.studentId !== session.userId) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { segmentId, segmentHeading, question, correct, bloomsLevel } = await req.json();
    if (!segmentId || typeof correct !== "boolean") {
      return NextResponse.json({ error: "segmentId and correct are required." }, { status: 400 });
    }
    const material = await studyMaterialsStore.recordQuizAttempt(
      params.id, segmentId, segmentHeading || "", question || "", correct, bloomsLevel,
    );
    if (!material) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ material });
  });
}
