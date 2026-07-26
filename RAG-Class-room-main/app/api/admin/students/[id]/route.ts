import { NextResponse } from "next/server";
import { studentsStore } from "@/lib/students-store";
import { subscriptionsStore } from "@/lib/subscriptions-store";
import { downloadsStore } from "@/lib/downloads-store";
import { withApiErrorHandling } from "@/lib/api-error";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// GET /api/admin/students/[id] — single student + their subscriptions + download history
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("GET /api/admin/students/[id]", async () => {
    const student = await studentsStore.byId(params.id);
    if (!student) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { passwordHash, ...safe } = student;

    const [subscriptions, downloads] = await Promise.all([
      subscriptionsStore.byStudent(params.id),
      downloadsStore.byStudent(params.id),
    ]);

    return NextResponse.json({ student: safe, subscriptions, downloads });
  });
}
