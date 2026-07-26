"use client";
/** Student-owned Google Drive backup helpers. Uses the narrow drive.file scope. */
declare global { interface Window { google?: any } }

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const PACKAGE_MIME = "application/vnd.ai-guru.offline-material+json";
const PACKAGE_MARKER = "ai-guru-offline-material";
let gisLoadPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Sign-In. Check your internet connection."));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

export function isDriveConfigured(): boolean { return !!CLIENT_ID; }

export async function requestStudentDriveAccess(): Promise<string> {
  if (!CLIENT_ID) throw new Error("Google Drive backup isn't configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID.");
  await loadGoogleIdentityServices();
  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (response: any) => response.error
          ? reject(new Error(response.error_description || response.error))
          : resolve(response.access_token),
      });
      tokenClient.requestAccessToken();
    } catch (e: any) { reject(new Error(e?.message || "Could not open Google sign-in.")); }
  });
}

export async function uploadToStudentDrive(blob: Blob, filename: string, mimeType: string, accessToken: string): Promise<{ id: string; webViewLink?: string }> {
  const metadata = { name: filename, mimeType };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", blob);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form,
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Drive upload failed (${res.status}).`); }
  return res.json();
}

export async function uploadOfflinePackageToDrive(blob: Blob, filename: string, materialId: string, accessToken: string): Promise<{ id: string; webViewLink?: string }> {
  const metadata = {
    name: filename,
    mimeType: PACKAGE_MIME,
    description: "AI Guru offline study-material backup",
    appProperties: { aiGuruType: PACKAGE_MARKER, materialId },
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", blob, filename);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,webViewLink", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form,
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Drive backup failed (${res.status}).`); }
  return res.json();
}

export type DriveOfflinePackage = { id: string; name: string; modifiedTime?: string; size?: string; webViewLink?: string; appProperties?: Record<string,string> };

export async function listOfflinePackagesFromDrive(accessToken: string): Promise<DriveOfflinePackage[]> {
  const q = encodeURIComponent(`trashed = false and appProperties has { key='aiGuruType' and value='${PACKAGE_MARKER}' }`);
  const fields = encodeURIComponent("files(id,name,modifiedTime,size,webViewLink,appProperties)");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=100&fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Could not list Drive backups (${res.status}).`); }
  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

export async function downloadOfflinePackageFromDrive(fileId: string, accessToken: string): Promise<Blob> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Drive download failed (${res.status}).`); }
  return res.blob();
}
