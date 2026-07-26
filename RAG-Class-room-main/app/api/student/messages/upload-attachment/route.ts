import { NextResponse } from "next/server";
import { uploadToGCS } from "@/lib/storage/gcs";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — a screenshot or a short document, not a video
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * POST /api/student/messages/upload-attachment
 * multipart/form-data: file
 *
 * Uploads a screenshot/file the student wants to show as part of their
 * support message, before the message itself is sent. Returns a signed
 * URL to attach to the outgoing message — this is a separate step from
 * sending the message itself so the chat UI can show an upload-in-
 * progress state and a preview before the student hits send.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/messages/upload-attachment", async () => {
    await requireStudentMatching();
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large — max 8 MB." }, { status: 413 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Use a JPG, PNG, WEBP screenshot, or a PDF." }, { status: 415 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
    const objectName = `message-attachments/${nanoid(10)}.${ext}`;
    await uploadToGCS(objectName, bytes, file.type);

    // Return the permanent GCS object name, NOT a signed URL — signed URLs
    // expire after 1 hour, so persisting one on the message would break
    // the attachment the moment anyone views the thread later than that.
    // A fresh signed URL is generated on every fetch instead (see the
    // messages API GET routes).
    return NextResponse.json({ ref: objectName, name: file.name, type: file.type });
  });
}
