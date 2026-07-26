import { NextResponse } from "next/server";
import { messagesStore } from "@/lib/messages-store";
import { studentsStore } from "@/lib/students-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";
import { generateBotReply } from "@/lib/support-bot";
import { downloadFromGCS } from "@/lib/storage/gcs";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// GET /api/student/messages?email=xxx — this student's threads, with
// fresh signed URLs for any attachments (never persisted, expire in 1hr).
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/student/messages", async () => {
    const email = new URL(req.url).searchParams.get("email");
    if (!email) return NextResponse.json({ error: "email is required." }, { status: 400 });
    await requireStudentMatching(email);
    const student = await studentsStore.byEmail(email);
    if (!student) return NextResponse.json({ threads: [] });
    const threads = await messagesStore.byStudent(student.id);
    threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const hydrated = await Promise.all(threads.map(t => messagesStore.hydrateAttachments(t)));
    return NextResponse.json({ threads: hydrated });
  });
}

// POST /api/student/messages — start a new thread
// body: { email, name, subject, text, attachmentRef?, attachmentName?, attachmentType? }
//
// The bot auto-responds immediately after the student's first message —
// real live-chat feel, no waiting for an admin to be online. If a
// screenshot was attached, the bot actually looks at it.
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/messages", async () => {
    const { email, name, subject, text, attachmentRef, attachmentName, attachmentType } = await req.json();
    if (!email || !text?.trim()) {
      return NextResponse.json({ error: "email and text are required." }, { status: 400 });
    }
    await requireStudentMatching(email);
    const student = await studentsStore.byEmail(email);
    let thread = await messagesStore.startThread({
      studentId: student?.id || email,
      studentName: student?.name || name || "Student",
      studentEmail: email,
      subject: subject?.trim() || "General question",
      text: text.trim(),
      attachmentRef, attachmentName, attachmentType,
    });

    // Bot's first response — best-effort, never blocks thread creation if
    // the AI call fails for any reason (student still sees their message
    // sent, just without an immediate bot reply).
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
      console.error("[bot reply on new thread]", e.message);
    }

    const hydrated = await messagesStore.hydrateAttachments(thread);
    return NextResponse.json({ thread: hydrated }, { status: 201 });
  });
}
