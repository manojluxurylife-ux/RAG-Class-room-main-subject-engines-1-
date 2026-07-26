import { NextResponse } from "next/server";
import { messagesStore } from "@/lib/messages-store";
import { withApiErrorHandling } from "@/lib/api-error";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// POST /api/admin/messages/[id] — admin replies to a thread. This is
// also the point where the bot goes quiet for this thread going forward
// (messagesStore.reply() sets adminHasReplied — a human is handling it now).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("POST /api/admin/messages/[id]", async () => {
    const { text } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: "text is required." }, { status: 400 });
    const thread = await messagesStore.reply(params.id, "admin", text.trim());
    if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    const hydrated = await messagesStore.hydrateAttachments(thread);
    return NextResponse.json({ thread: hydrated });
  });
}

// PATCH /api/admin/messages/[id] — mark resolved / reopen
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("PATCH /api/admin/messages/[id]", async () => {
    const { status } = await req.json();
    if (status !== "open" && status !== "resolved") {
      return NextResponse.json({ error: "status must be 'open' or 'resolved'." }, { status: 400 });
    }
    const thread = await messagesStore.setStatus(params.id, status);
    if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    return NextResponse.json({ thread });
  });
}
