import { NextResponse } from "next/server";
import { downloadsStore } from "@/lib/downloads-store";
import { withApiErrorHandling } from "@/lib/api-error";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// GET /api/admin/downloads — download log + aggregate stats for the admin dashboard
export async function GET() {
  return withApiErrorHandling("GET /api/admin/downloads", async () => {
    const [all, stats] = await Promise.all([downloadsStore.all(), downloadsStore.stats()]);
    return NextResponse.json({ downloads: all.slice(-100).reverse(), stats });
  });
}
