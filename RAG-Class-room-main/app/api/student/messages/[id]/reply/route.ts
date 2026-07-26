import { NextResponse } from "next/server";
import { messagesStore } from "@/lib/messages-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching, sessionOwns } from "@/lib/auth";
import { generateBotReply } from "@/lib/support-bot";
import { downloadFromGCS } from "@/lib/storage/gcs";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// POST /api/student/messages/[id]/reply — student adds a follow-up
// body: { text, attachmentRef?, attachmentName?, attachmentType? }
//
// The bot keeps responding to follow-ups too — but ONLY until an admin
// has actually replied in this thread (messagesStore's adminHasReplied
// flag). Once a human is handling it, the bot goes quiet — it shouldn't
// talk over an admin who's already in the conversation.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("POST /api/student/messages/[id]/reply", async () => {
    const { text, attachmentRef, attachmentName, attachmentType } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: "text is required." }, { status: 400 });

    // Ownership check BEFORE the write — threads store either the
    // student's id or (for pre-account senders) their email as studentId,
    // so both are accepted; same 404 for "missing" and "not yours".
    const session = await requireStudentMatching();
    const existing = await messagesStore.byId(params.id);
    if (!existing || !(sessionOwns(session, existing.studentId) || sessionOwns(session, existing.studentEmail))) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }

    let thread = await messagesStore.reply(
      params.id, "student", text.trim(),
      attachmentRef ? { ref: attachmentRef, name: attachmentName, type: attachmentType } : undefined,
    );
    if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

    if (!thread.adminHasReplied) {
      try {
        let botText: string;
        if (attachmentRef && attachmentType?.startsWith("image/")) {
          const { bytes } = await downloadFromGCS(attachmentRef);
          botText = await generateBotReply(text.trim(), {
            base64: bytes.toString("base64"),
            mimeType: attachmentType as "image/jpeg" | "image/png" | "image/webp",
          });
        } else {
          botText = await generateBotReply(text.trim());
        }
        const withBotReply = await messagesStore.reply(thread.id, "bot", botText.trim());
        if (withBotReply) thread = withBotReply;
      } catch (e: any) {
        console.error("[bot reply on follow-up]", e.message);
      }
    }

    const hydrated = await messagesStore.hydrateAttachments(thread);
    return NextResponse.json({ thread: hydrated });
  });
}
