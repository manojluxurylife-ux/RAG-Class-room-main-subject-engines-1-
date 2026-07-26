/**
 * Google Drive storage adapter.
 *
 * Setup (one-time):
 *  1. Create a Google Cloud project → enable Drive API.
 *  2. Create a Service Account → download JSON key → set GOOGLE_SA_KEY env var.
 *  3. Share the folder(s) you want students to access with the service account email.
 *
 * Alternatively, set GOOGLE_DRIVE_API_KEY (read-only API key) for public/shared-link folders.
 *
 * WRITE PATH (uploadToAdminDrive): added as fallback storage for generated
 * study materials when GCS isn't configured — see lib/storage/gcs.ts and
 * lib/storage/persist-material.ts for how this fits into the fallback
 * chain. Needs the broader `drive` scope (drive.readonly can't write),
 * so it builds its own auth client rather than reusing getDriveClient().
 * The service account has no storage quota of its own on My Drive; the
 * shared folder (GOOGLE_DRIVE_FOLDER_ID) must belong to a real Google
 * Workspace/consumer account that owns storage, or use a Shared Drive.
 */
import { google } from "googleapis";
import { Readable } from "node:stream";

function getDriveClient() {
  const saKey = process.env.GOOGLE_SA_KEY;
  if (saKey) {
    const creds  = JSON.parse(saKey);
    const auth   = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    return google.drive({ version: "v3", auth });
  }
  // Fallback: API key (only works for public / shared-link files)
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (apiKey) {
    return google.drive({ version: "v3", auth: apiKey });
  }
  throw new Error(
    "Google Drive is not configured. Set GOOGLE_SA_KEY (service account JSON) " +
    "or GOOGLE_DRIVE_API_KEY in your .env.local file.",
  );
}

export function adminDriveWriteConfigured(): boolean {
  return !!(process.env.GOOGLE_SA_KEY && process.env.GOOGLE_DRIVE_FOLDER_ID);
}

function getDriveWriteClient() {
  const saKey = process.env.GOOGLE_SA_KEY;
  if (!saKey) throw new Error("GOOGLE_SA_KEY is not set — admin Drive fallback storage is unavailable.");
  const creds = JSON.parse(saKey);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    // drive.readonly (used elsewhere in this file for listing/streaming
    // admin-curated materials) cannot create files — this narrower-than-
    // full-drive scope is the minimum that permits writes.
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

/**
 * Uploads a generated file into the shared admin Drive folder
 * (GOOGLE_DRIVE_FOLDER_ID) — fallback storage for study materials when
 * GCS isn't configured. Returns the Drive file id and a viewable link.
 * Throws if GOOGLE_SA_KEY / GOOGLE_DRIVE_FOLDER_ID aren't set; callers
 * should check adminDriveWriteConfigured() first, or catch and continue
 * without a persisted file rather than letting this fail the request —
 * material generation itself must never depend on storage succeeding.
 */
export async function uploadToAdminDrive(
  name: string,
  bytes: Buffer,
  mimeType: string,
): Promise<{ id: string; webViewLink?: string }> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set — admin Drive fallback storage is unavailable.");
  const drive = getDriveWriteClient();
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: Readable.from(bytes) },
    fields: "id,webViewLink",
  });
  return { id: res.data.id!, webViewLink: res.data.webViewLink || undefined };
}

export async function listDriveFolder(folderId: string): Promise<{
  id: string; name: string; mimeType: string; size: string; modifiedTime: string;
}[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,size,modifiedTime)",
    pageSize: 200,
    orderBy: "name",
  });
  return (res.data.files || []) as any[];
}

export async function listDriveRoot(): Promise<{
  id: string; name: string; mimeType: string; size: string; modifiedTime: string;
}[]> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error(
      "Set GOOGLE_DRIVE_FOLDER_ID to the Drive folder ID containing your study materials.",
    );
  }
  return listDriveFolder(rootFolderId);
}

export function mimeToFileType(mime: string): "pdf" | "image" | "video" | "other" {
  if (mime === "application/pdf")              return "pdf";
  if (mime.startsWith("image/"))               return "image";
  if (mime.startsWith("video/"))               return "video";
  return "other";
}

/**
 * Download a Drive file and pipe it to a Node.js Readable stream.
 * Used by /api/student/materials/[id]/download for Drive-sourced materials.
 */
export async function streamDriveFile(fileId: string): Promise<{
  stream: NodeJS.ReadableStream; mimeType: string; name: string;
}> {
  const drive = getDriveClient();

  // Get metadata first so we can set the correct Content-Type
  const meta = await drive.files.get({ fileId, fields: "name,mimeType,exportLinks" });
  const name = meta.data.name || "file";
  let mimeType = meta.data.mimeType || "application/octet-stream";

  // Google Workspace files (Docs, Sheets, Slides) need export
  const exportLinks = meta.data.exportLinks || {};
  let res: any;
  if (mimeType === "application/vnd.google-apps.document") {
    res = await drive.files.export({ fileId, mimeType: "application/pdf" }, { responseType: "stream" });
    mimeType = "application/pdf";
  } else if (Object.keys(exportLinks).length > 0) {
    res = await drive.files.export({ fileId, mimeType: "application/pdf" }, { responseType: "stream" });
    mimeType = "application/pdf";
  } else {
    res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
  }

  return { stream: res.data, mimeType, name };
}
