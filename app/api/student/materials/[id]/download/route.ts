import { NextResponse }   from "next/server";
import { getSession } from "@/lib/auth";
import { materialsStore } from "@/lib/materials-store";
import { downloadsStore } from "@/lib/downloads-store";
import { streamDriveFile }   from "@/lib/storage/drive";
import { signedDownloadUrl } from "@/lib/storage/gcs";
import { vpsPublicUrl }      from "@/lib/storage/vps";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * GET /api/student/materials/[id]/download?studentId=xxx&email=xxx&name=xxx
 *
 * Routes the download to the correct backend, and logs every successful
 * download to downloadsStore so the admin can see usage — which materials
 * are actually being opened, and by whom.
 *
 *  drive  → streams the file through this server (so students don't need a Google account)
 *  gcs    → redirects to a short-lived (1 hr) signed URL — GCS serves directly, zero server bandwidth
 *  vps    → redirects to the static public URL — nginx serves directly
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  // Published materials are still gated behind a signed-in session —
  // without this, download links (which log student identity from
  // spoofable query params) were open to the whole internet.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in to download materials." }, { status: 401 });
  }

  const material = await materialsStore.byId(params.id);
  const { searchParams } = new URL(req.url);
  const studentId    = searchParams.get("studentId") || undefined;
  const studentEmail = searchParams.get("email")     || undefined;
  const studentName  = searchParams.get("name")      || undefined;

  if (!material) {
    return NextResponse.json({ error: "Material not found." }, { status: 404 });
  }
  if (!material.published) {
    return NextResponse.json({ error: "This material is not available." }, { status: 403 });
  }

  // ── PREVIEW MODE (?preview=1) ─────────────────────────────────────────
  // Used by the shared-textbook browser to render the first 2-3 pages
  // client-side with pdf.js BEFORE the student decides to download.
  // Two differences from a normal download:
  //  1. gcs/vps are PROXIED through this server instead of redirected —
  //     a redirect to a signed GCS/nginx URL fails the browser's CORS
  //     check when fetched as bytes, so same-origin streaming is the
  //     only reliable way for pdf.js to read the file.
  //  2. It is NOT logged to downloadsStore — looking at three pages to
  //     check "is this my book?" is not a download, and counting it as
  //     one would corrupt the admin's usage numbers.
  const isPreview = searchParams.get("preview") === "1";
  if (isPreview && (material.source === "gcs" || material.source === "vps")) {
    const url = material.source === "gcs"
      ? await signedDownloadUrl(material.sourceRef)
      : vpsPublicUrl(material.sourceRef);
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Preview unavailable." }, { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  // Log the download — best-effort, never blocks or fails the actual download.
  if (!isPreview) {
  downloadsStore.log({
    materialId: material.id,
    materialTitle: material.title,
    studentId, studentEmail, studentName,
    downloadedAt: new Date().toISOString(),
  }).catch(e => console.error("[download log]", e.message));
  }

  try {
    switch (material.source) {
      // ── Google Drive ──────────────────────────────────────────────────────
      case "drive": {
        const { stream, mimeType, name } = await streamDriveFile(material.sourceRef);

        // Stream through Next.js so students never need Google auth
        const readable = stream as any;
        const webStream = new ReadableStream({
          start(controller) {
            readable.on("data",  (chunk: Buffer) => controller.enqueue(chunk));
            readable.on("end",   ()               => controller.close());
            readable.on("error", (e: Error)       => controller.error(e));
          },
        });

        const safeName = encodeURIComponent(name || material.title);
        return new Response(webStream, {
          headers: {
            "Content-Type": mimeType,
            "Content-Disposition": `attachment; filename="${safeName}"`,
            "Cache-Control": "private, no-store",
          },
        });
      }

      // ── Google Cloud Storage ──────────────────────────────────────────────
      case "gcs": {
        const url = await signedDownloadUrl(material.sourceRef);
        return NextResponse.redirect(url);
      }

      // ── VPS / local filesystem ────────────────────────────────────────────
      case "vps": {
        const url = vpsPublicUrl(material.sourceRef);
        return NextResponse.redirect(url);
      }

      // ── Generated content (lesson plans, quizzes, etc.) ─────────────────
      case "generated": {
        const safeName = encodeURIComponent(`${material.title}.md`);
        return new Response(material.content || "", {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="${safeName}"`,
            "Cache-Control": "private, no-store",
          },
        });
      }

      default:
        return NextResponse.json({ error: "Unknown source." }, { status: 500 });
    }
  } catch (e: any) {
    console.error("[download]", e.message);
    return NextResponse.json({ error: "Download failed. Please try again." }, { status: 502 });
  }
}
