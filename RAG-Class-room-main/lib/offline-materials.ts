"use client";

const DB_NAME = "ai-guru-offline-library";
const DB_VERSION = 1;
const STORE = "materials";

export type OfflineMaterialKind = "material-studio" | "study-course";

export type OfflineMaterialRecord = {
  id: string;
  kind: OfflineMaterialKind;
  title: string;
  topic?: string;
  materialType?: string;
  documentId?: string;
  data: any;
  textbookBlob?: Blob;
  textbookMimeType?: string;
  createdAt: string;
  updatedAt: string;
  version: 1;
};

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) return Promise.reject(new Error("Offline storage is not supported in this browser."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("kind", "kind");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open offline storage."));
  });
}

async function put(record: OfflineMaterialRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Could not save material offline."));
  });
  db.close();
}

/** Pure record construction, no I/O — extracted so a caller can build
 *  the exact same record for a Google Drive fallback upload even when
 *  the local IndexedDB write itself is what's failing (device out of
 *  space). See lib/client/save-with-drive-fallback.ts. */
export function buildStudioMaterialRecord(args: {
  material: any;
  materialType: string;
  topic: string;
  documentId?: string;
}): OfflineMaterialRecord {
  const now = new Date().toISOString();
  const stableId = String(args.material?.offlineId || args.material?.id || `studio-${crypto.randomUUID()}`);
  return {
    id: stableId,
    kind: "material-studio",
    title: String(args.material?.title || args.topic || "Study material"),
    topic: args.topic,
    materialType: args.materialType,
    documentId: args.documentId,
    data: { ...args.material, offlineId: stableId },
    createdAt: String(args.material?.offlineCreatedAt || now),
    updatedAt: now,
    version: 1,
  };
}

export async function saveStudioMaterial(args: {
  material: any;
  materialType: string;
  topic: string;
  documentId?: string;
}): Promise<OfflineMaterialRecord> {
  const record = buildStudioMaterialRecord(args);
  await put(record);
  return record;
}

export async function saveStudyCourse(args: {
  material: any;
  textbookBlob?: Blob;
  textbookMimeType?: string;
}): Promise<OfflineMaterialRecord> {
  const now = new Date().toISOString();
  const id = `study-${String(args.material?.id || crypto.randomUUID())}`;
  const record: OfflineMaterialRecord = {
    id,
    kind: "study-course",
    title: String(args.material?.title || "Study course"),
    topic: String(args.material?.subject || ""),
    materialType: "guided-course",
    data: args.material,
    textbookBlob: args.textbookBlob,
    textbookMimeType: args.textbookMimeType || args.material?.textbookMimeType,
    createdAt: String(args.material?.createdAt || now),
    updatedAt: now,
    version: 1,
  };
  await put(record);
  return record;
}

export async function getOfflineMaterial(id: string): Promise<OfflineMaterialRecord | null> {
  const db = await openDb();
  const result = await new Promise<OfflineMaterialRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not read offline material."));
  });
  db.close();
  return result || null;
}

export async function getOfflineStudyCourse(materialId: string): Promise<OfflineMaterialRecord | null> {
  return getOfflineMaterial(`study-${materialId}`);
}

export async function listOfflineMaterials(): Promise<OfflineMaterialRecord[]> {
  const db = await openDb();
  const result = await new Promise<OfflineMaterialRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("Could not list offline materials."));
  });
  db.close();
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteOfflineMaterial(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Could not delete offline material."));
  });
  db.close();
}

export async function fetchBlobForOffline(url?: string | null): Promise<Blob | undefined> {
  if (!url || typeof navigator === "undefined" || !navigator.onLine) return undefined;
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return undefined;
    return await response.blob();
  } catch {
    return undefined;
  }
}

export type PortableOfflinePackage = {
  format: "ai-guru-offline-material";
  packageVersion: 1;
  exportedAt: string;
  record: Omit<OfflineMaterialRecord, "textbookBlob"> & { textbookBase64?: string };
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not package textbook file."));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(",", 2);
  if (!header || payload === undefined) throw new Error("Invalid textbook attachment in backup.");
  const mime = /data:([^;]+)/.exec(header)?.[1] || "application/octet-stream";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function createPortableOfflinePackage(item: OfflineMaterialRecord): Promise<Blob> {
  const { textbookBlob, ...rest } = item;
  const pkg: PortableOfflinePackage = {
    format: "ai-guru-offline-material",
    packageVersion: 1,
    exportedAt: new Date().toISOString(),
    record: {
      ...rest,
      textbookBase64: textbookBlob ? await blobToDataUrl(textbookBlob) : undefined,
    },
  };
  return new Blob([JSON.stringify(pkg)], { type: "application/vnd.ai-guru.offline-material+json" });
}

export async function importPortableOfflinePackage(input: Blob | string): Promise<OfflineMaterialRecord> {
  const text = typeof input === "string" ? input : await input.text();
  let pkg: PortableOfflinePackage;
  try { pkg = JSON.parse(text); }
  catch { throw new Error("This is not a valid AI Guru offline package."); }
  if (pkg?.format !== "ai-guru-offline-material" || pkg.packageVersion !== 1 || !pkg.record?.id) {
    throw new Error("Unsupported or damaged AI Guru offline package.");
  }
  const { textbookBase64, ...recordData } = pkg.record;
  const now = new Date().toISOString();
  const record: OfflineMaterialRecord = {
    ...recordData,
    textbookBlob: textbookBase64 ? dataUrlToBlob(textbookBase64) : undefined,
    updatedAt: now,
    version: 1,
  } as OfflineMaterialRecord;
  await put(record);
  return record;
}
