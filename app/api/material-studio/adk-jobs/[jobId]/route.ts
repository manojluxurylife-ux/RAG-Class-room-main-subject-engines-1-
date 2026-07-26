import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/auth";
import { adkMaterialJobs } from "@/lib/adk-material-jobs";

import { serverAiEnabledOnServer } from "@/lib/ai-features";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { jobId: string } }) {
  if (!serverAiEnabledOnServer()) return NextResponse.json({ error: "Managed Server AI is temporarily disabled." }, { status: 503 });
  try {
    const session = await requireStudent();
    const job = await adkMaterialJobs.byId(params.jobId);
    if (!job || job.ownerId !== session.userId) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      result: job.status === "completed" ? job.result : undefined,
      error: job.status === "failed" ? job.error : undefined,
      updatedAt: job.updatedAt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not read ADK job." }, { status: error?.status || 500 });
  }
}
