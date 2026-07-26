import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { checkCloudHealth } from "@/lib/cloud-health";
import { withApiErrorHandling } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrorHandling("GET /api/admin/cloud-health", async () => {
    await requireRole("admin");
    const health = await checkCloudHealth();
    const ok = Object.values(health).every(item => item.ok);
    return NextResponse.json({ ok, health, checkedAt: new Date().toISOString() }, { status: ok ? 200 : 503 });
  });
}
