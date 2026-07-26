import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { downloadFromGCS } from "@/lib/storage/gcs";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/[id] — serves whatever was stored via uploadToGCS()
 * (see lib/storage/gcs.ts for the full story: that function was a
 * no-op stub until now, so this route's original stored_files/
 * collectionHelpers logic was never actually reachable — nothing ever
 * wrote to that collection, since uploadToGCS() never called it).
 *
 * id is base64url(objectName) — this route's own pre-existing
 * convention (see signedDownloadUrl in lib/storage/gcs.ts, which
 * builds URLs this way to match it) for turning an arbitrary object
 * name into something URL-safe.
 *
 * Requires ANY valid session rather than a strict per-owner check —
 * object names/ids are opaque, internally generated references never
 * exposed for a student to browse on their own, so this is a
 * reasonable bar for what's stored today (textbook-page photos,
 * message attachments), not a full ACL. Unlike a real GCS signed URL
 * this link doesn't expire.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let objectName: string;
  try { objectName = Buffer.from(params.id, "base64url").toString("utf8"); }
  catch { return NextResponse.json({ error: "File not found." }, { status: 404 }); }

  try {
    const { bytes, contentType } = await downloadFromGCS(objectName);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        // Object names are unique per upload (never reused for
        // different content), so this is safe to cache aggressively.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "File not found." }, { status: 404 });
  }
}
