import { NextResponse } from "next/server";
import { messagesStore } from "@/lib/messages-store";
import { withApiErrorHandling } from "@/lib/api-error";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// GET /api/admin/messages — all support threads, newest activity first,
// with fresh signed URLs for any attachments.
export async function GET() {
  return withApiErrorHandling("GET /api/admin/messages", async () => {
    const threads = await messagesStore.all();
    threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const hydrated = await Promise.all(threads.map(t => messagesStore.hydrateAttachments(t)));
    const stats = await messagesStore.stats();
    return NextResponse.json({ threads: hydrated, stats });
  });
}
