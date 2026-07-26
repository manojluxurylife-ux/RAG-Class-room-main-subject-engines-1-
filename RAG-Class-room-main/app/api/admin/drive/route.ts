import { NextResponse } from "next/server";
import { listDriveRoot, listDriveFolder, mimeToFileType } from "@/lib/storage/drive";

// GET /api/admin/drive?folderId=xxx (omit folderId to list root folder from env)
export async function GET(req: Request) {
  const folderId = new URL(req.url).searchParams.get("folderId") || "";
  try {
    const files = folderId ? await listDriveFolder(folderId) : await listDriveRoot();
    return NextResponse.json({
      files: files.map(f => ({
        id:       f.id,
        name:     f.name,
        mimeType: f.mimeType,
        fileType: mimeToFileType(f.mimeType),
        size:     Number(f.size || 0),
        modified: f.modifiedTime,
        isFolder: f.mimeType === "application/vnd.google-apps.folder",
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
