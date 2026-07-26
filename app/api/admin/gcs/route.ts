import { NextResponse } from "next/server";
import { listGCSFolder, gcsNameToFileType } from "@/lib/storage/gcs";

// GET /api/admin/gcs?prefix=subfolder/
export async function GET(req: Request) {
  const prefix = new URL(req.url).searchParams.get("prefix") || "";
  try {
    const files = await listGCSFolder(prefix);
    return NextResponse.json({
      files: files.map(f => ({
        name:     f.name,
        fileType: gcsNameToFileType(f.name),
        size:     f.size,
        modified: f.updated,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
