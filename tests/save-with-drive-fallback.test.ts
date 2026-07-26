/**
 * Tests for lib/client/save-with-drive-fallback.ts — save to device
 * first (what makes offline classroom playback work), fall back to the
 * student's own Google Drive, with permission, only when the local
 * save genuinely fails (device storage exhausted).
 *
 * The real implementations (IndexedDB, Google's OAuth popup) need an
 * actual browser, so these tests inject fakes via the same dependency-
 * injection pattern already used elsewhere in this app
 * (lib/exam-patterns.ts) — every real call site uses the defaults
 * (the real functions) unchanged; only tests override them.
 *
 * Run with: npx tsx --test tests/save-with-drive-fallback.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { saveStudioMaterialWithDriveFallback, resetDriveSession } from "../lib/client/save-with-drive-fallback";

const baseArgs = { material: { title: "Photosynthesis Notes" }, materialType: "memory", topic: "Photosynthesis", documentId: "doc-1" };
const fakeRecord = { id: "studio-1", kind: "material-studio" as const, title: "Photosynthesis Notes", materialType: "memory", data: {}, createdAt: "now", updatedAt: "now", version: 1 as const };

test("saves to the device and returns 'device' when the local save succeeds — the normal, expected case", async () => {
  resetDriveSession();
  let driveWasCalled = false;
  const result = await saveStudioMaterialWithDriveFallback({
    ...baseArgs,
    saveLocal: async () => fakeRecord,
    requestAccess: async () => { driveWasCalled = true; return "token"; },
  });
  assert.equal(result.savedTo, "device");
  assert.equal(driveWasCalled, false, "Drive must never be touched when the device save succeeds");
});

test("falls back to Drive when the local save fails, and reports the outcome as 'drive'", async () => {
  resetDriveSession();
  const result = await saveStudioMaterialWithDriveFallback({
    ...baseArgs,
    saveLocal: async () => { throw new DOMException("Storage full", "QuotaExceededError"); },
    buildRecord: () => fakeRecord,
    requestAccess: async () => "fresh-token",
    driveConfigured: () => true,
    packageRecord: async () => new Blob(["{}"]),
    uploadPackage: async () => ({ id: "drive-file-1", webViewLink: "https://drive.google.com/file/drive-file-1" }),
  });
  assert.equal(result.savedTo, "drive");
  if (result.savedTo === "drive") assert.equal(result.driveLink, "https://drive.google.com/file/drive-file-1");
});

test("asks for Drive permission only ONCE across many saves in the same batch — the token is cached and reused", async () => {
  resetDriveSession();
  let permissionRequests = 0;
  let uploads = 0;
  const call = () => saveStudioMaterialWithDriveFallback({
    ...baseArgs,
    saveLocal: async () => { throw new Error("full"); },
    buildRecord: () => fakeRecord,
    requestAccess: async () => { permissionRequests++; return "token"; },
    driveConfigured: () => true,
    packageRecord: async () => new Blob(["{}"]),
    uploadPackage: async () => { uploads++; return { id: "x" }; },
  });
  await call(); await call(); await call();
  assert.equal(permissionRequests, 1, "must only prompt for Drive permission once per batch, not once per material");
  assert.equal(uploads, 3, "but every material still gets uploaded");
});

test("onFallbackStarting fires before the permission prompt, exactly once, only when a fallback is actually needed", async () => {
  resetDriveSession();
  let fired = 0;
  await saveStudioMaterialWithDriveFallback({
    ...baseArgs,
    saveLocal: async () => fakeRecord,
    onFallbackStarting: () => fired++,
  });
  assert.equal(fired, 0, "must not fire when the device save succeeds");

  resetDriveSession();
  await saveStudioMaterialWithDriveFallback({
    ...baseArgs,
    saveLocal: async () => { throw new Error("full"); },
    buildRecord: () => fakeRecord,
    requestAccess: async () => "token",
    driveConfigured: () => true,
    packageRecord: async () => new Blob(["{}"]),
    uploadPackage: async () => ({ id: "x" }),
    onFallbackStarting: () => fired++,
  });
  assert.equal(fired, 1);
});

test("returns 'failed' with a clear message when Drive isn't configured and the device save failed", async () => {
  resetDriveSession();
  const result = await saveStudioMaterialWithDriveFallback({
    ...baseArgs,
    saveLocal: async () => { throw new Error("Device is full"); },
    driveConfigured: () => false,
  });
  assert.equal(result.savedTo, "failed");
  if (result.savedTo === "failed") assert.ok(result.error.length > 0);
});

test("returns 'failed' (not a thrown exception) when BOTH the device save and the Drive upload fail", async () => {
  resetDriveSession();
  const result = await saveStudioMaterialWithDriveFallback({
    ...baseArgs,
    saveLocal: async () => { throw new Error("Device is full"); },
    buildRecord: () => fakeRecord,
    requestAccess: async () => "token",
    driveConfigured: () => true,
    packageRecord: async () => new Blob(["{}"]),
    uploadPackage: async () => { throw new Error("Network unavailable"); },
  });
  assert.equal(result.savedTo, "failed");
});

test("resetDriveSession() forces the next save to request a fresh token", async () => {
  resetDriveSession();
  let permissionRequests = 0;
  const call = () => saveStudioMaterialWithDriveFallback({
    ...baseArgs,
    saveLocal: async () => { throw new Error("full"); },
    buildRecord: () => fakeRecord,
    requestAccess: async () => { permissionRequests++; return "token"; },
    driveConfigured: () => true,
    packageRecord: async () => new Blob(["{}"]),
    uploadPackage: async () => ({ id: "x" }),
  });
  await call();
  resetDriveSession();
  await call();
  assert.equal(permissionRequests, 2);
});
