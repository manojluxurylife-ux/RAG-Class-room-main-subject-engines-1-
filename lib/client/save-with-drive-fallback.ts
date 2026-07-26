"use client";
/**
 * Saves a study material to the device first (IndexedDB, via
 * lib/offline-materials.ts) — this is what makes offline classroom
 * playback work at all, so it stays the default path for every save,
 * with zero behavior change for the normal case where the device has
 * room. Only when that write genuinely fails (device storage exhausted
 * — a real, expected situation for the budget Android phones this app
 * targets) does this fall back to the student's own Google Drive,
 * asking their permission first.
 *
 * HONEST LIMITATION, not hidden: a material saved to Drive instead of
 * the device is NOT available for offline classroom teaching later —
 * it needs a network connection and the student's Drive sign-in to
 * retrieve. This is a last-resort safety net so material creation
 * doesn't simply fail when a device is full, not a replacement for
 * local storage, which is what this app is built around.
 */
import {
  saveStudioMaterial, buildStudioMaterialRecord, createPortableOfflinePackage,
  type OfflineMaterialRecord,
} from "@/lib/offline-materials";
import { requestStudentDriveAccess, uploadOfflinePackageToDrive, isDriveConfigured } from "@/lib/student-drive";

export type SaveOutcome =
  | { savedTo: "device"; record: OfflineMaterialRecord }
  | { savedTo: "drive"; record: OfflineMaterialRecord; driveLink?: string }
  | { savedTo: "failed"; error: string };

/**
 * Reuses one Drive access token for an entire batch of saves (Material
 * Studio can save 50+ materials in one run) instead of prompting the
 * student for permission separately for every single one — Google's
 * access tokens are valid for about an hour, comfortably longer than
 * any realistic batch run. Cleared automatically once expired, or can
 * be reset explicitly with resetDriveSession() (e.g. if an upload
 * fails with an auth error and a fresh token is needed).
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

export function resetDriveSession() { cachedToken = null; }

async function getDriveAccessToken(requestAccess: () => Promise<string>, onFirstRequest?: () => void): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  onFirstRequest?.();
  const token = await requestAccess();
  // Google's default token lifetime is ~3600s; stay conservative (55
  // minutes) so a save never straddles the real expiry mid-upload.
  cachedToken = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

function safeDriveFilename(title: string, materialType: string): string {
  const base = String(title || materialType || "study-material").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `ai-guru-${base}.json`;
}

export interface SaveWithDriveFallbackOptions {
  material: any;
  materialType: string;
  topic: string;
  documentId?: string;
  /** Called once, only if a fallback is actually needed, before the
   *  Drive permission prompt appears — lets the caller show an in-app
   *  "your device is low on space, asking for Drive permission" message
   *  BEFORE Google's own consent popup shows up out of nowhere. */
  onFallbackStarting?: () => void;
  // Injectable for testing — every call site in this app uses the real
  // implementations (the defaults below), which is why none of them
  // need to pass these.
  saveLocal?: typeof saveStudioMaterial;
  buildRecord?: typeof buildStudioMaterialRecord;
  requestAccess?: () => Promise<string>;
  packageRecord?: typeof createPortableOfflinePackage;
  uploadPackage?: typeof uploadOfflinePackageToDrive;
  driveConfigured?: () => boolean;
}

export async function saveStudioMaterialWithDriveFallback(options: SaveWithDriveFallbackOptions): Promise<SaveOutcome> {
  const {
    onFallbackStarting,
    saveLocal = saveStudioMaterial,
    buildRecord = buildStudioMaterialRecord,
    requestAccess = requestStudentDriveAccess,
    packageRecord = createPortableOfflinePackage,
    uploadPackage = uploadOfflinePackageToDrive,
    driveConfigured = isDriveConfigured,
    ...args
  } = options;

  try {
    const record = await saveLocal(args);
    return { savedTo: "device", record };
  } catch (localError: any) {
    // Any local save failure falls back to Drive, not just an explicit
    // QuotaExceededError — a full device can surface storage failures
    // in more than one shape across browsers, and the safety net should
    // cover all of them, not just the one with the cleanest name.
    if (!driveConfigured()) {
      return { savedTo: "failed", error: localError?.message || "Could not save this material — the device appears to be out of storage space." };
    }
    try {
      const record = buildRecord(args);
      const token = await getDriveAccessToken(requestAccess, onFallbackStarting);
      const pkg = await packageRecord(record);
      const uploaded = await uploadPackage(pkg, safeDriveFilename(record.title, record.materialType || ""), record.id, token);
      return { savedTo: "drive", record, driveLink: uploaded.webViewLink };
    } catch (driveError: any) {
      return { savedTo: "failed", error: driveError?.message || "Could not save this material to the device or to Google Drive." };
    }
  }
}
