import { uploadToGCS } from "@/lib/storage/gcs";
import { uploadToAdminDrive, adminDriveWriteConfigured } from "@/lib/storage/drive";

export interface PersistResult {
  persisted: boolean;
  backend: "gcs-or-db" | "drive" | "none";
  objectName?: string;    // for backend "gcs-or-db" — pass to signedDownloadUrl/downloadFromGCS
  driveFileId?: string;
  driveViewLink?: string;
  warning?: string;
}

/**
 * Tries to persist a generated study-material file, in order:
 *
 *   1. lib/storage/gcs.ts's uploadToGCS — now genuinely backed by
 *      Upstash Redis (previously a no-op stub that silently discarded
 *      every upload — see that file's comments for the full story).
 *      Covers most generated JSON-ish materials fine on its own, up to
 *      Upstash's per-value payload limit (~1MB on lower tiers).
 *
 *   2. If that throws — realistically because the file is too big for
 *      Upstash (e.g. a real .pptx deck) — fall back to the admin's
 *      Google Drive (lib/storage/drive.ts), which has no comparable
 *      size ceiling.
 *
 *   3. If neither is available, this does NOT throw. Study material
 *      generation must succeed regardless of whether there's anywhere
 *      to archive the output — callers get persisted:false and a
 *      human-readable warning, and should still return the generated
 *      content to the user rather than failing the request.
 *
 * This is deliberately the only place that decides the storage fallback
 * order, so call sites (generate-slides, study-materials, etc.) don't
 * each re-implement their own try/catch/give-up logic differently.
 */
export async function persistMaterialFile(
  objectName: string,
  bytes: Buffer,
  mimeType: string,
): Promise<PersistResult> {
  try {
    await uploadToGCS(objectName, bytes, mimeType);
    return { persisted: true, backend: "gcs-or-db", objectName };
  } catch (gcsErr: any) {
    if (adminDriveWriteConfigured()) {
      try {
        const { id, webViewLink } = await uploadToAdminDrive(
          objectName.replace(/\//g, "_"),
          bytes,
          mimeType,
        );
        return { persisted: true, backend: "drive", driveFileId: id, driveViewLink: webViewLink };
      } catch (driveErr: any) {
        return {
          persisted: false,
          backend: "none",
          warning:
            `Could not save this material to storage (GCS/DB: ${gcsErr.message}; ` +
            `Drive: ${driveErr.message}). The generated content is still available below.`,
        };
      }
    }
    return {
      persisted: false,
      backend: "none",
      warning:
        `Could not save this material to storage (${gcsErr.message}). The generated content ` +
        `is still available below — set GCS_KEY_JSON, or GOOGLE_SA_KEY + GOOGLE_DRIVE_FOLDER_ID, to enable saving it.`,
    };
  }
}
