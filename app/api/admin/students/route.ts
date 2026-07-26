import { NextResponse } from "next/server";
import { studentsStore } from "@/lib/students-store";
import { withApiErrorHandling } from "@/lib/api-error";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// GET /api/admin/students — full list (password-safe) for the admin Users page
export async function GET() {
  return withApiErrorHandling("GET /api/admin/students", async () => {
    const students = await studentsStore.allPublic();
    return NextResponse.json({ students });
  });
}
