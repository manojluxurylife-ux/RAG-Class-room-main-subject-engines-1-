/**
 * Stores the original uploaded PDF file (not just its extracted text) so
 * the classroom hub can render it in the left-hand pane later. The RAG
 * ingest pipeline (lib/rag/store.ts) only ever persists extracted text —
 * there was nowhere the actual PDF bytes were kept, so re-opening a
 * textbook had nothing to show on the left. IndexedDB (not localStorage —
 * PDFs are too large and localStorage is string-only) keyed by documentId
 * fixes that, entirely client-side.
 */
const DB_NAME = "ai-guru-pdfs";
const STORE = "pdfs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePdf(documentId: string, file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, documentId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Returns a blob: object URL for the stored PDF, or null if none was saved
 *  for this documentId (e.g. it was ingested in a session before this
 *  feature existed, or on a different device/browser — storage is local
 *  only, nothing is uploaded to a server). Caller is responsible for
 *  revoking the URL (URL.revokeObjectURL) when done with it. */
export async function getPdfUrl(documentId: string): Promise<string | null> {
  const db = await openDb();
  const file = await new Promise<File | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(documentId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return file ? URL.createObjectURL(file) : null;
}

/** Returns the raw stored File (not a blob: URL) — used where the caller
 *  needs to run it back through pdfjs itself (page-count, thumbnails,
 *  rasterising a single page), rather than just handing a URL to an
 *  <iframe>. Same storage, same null-if-never-saved contract as
 *  getPdfUrl() above. */
export async function getPdfFile(documentId: string): Promise<File | null> {
  const db = await openDb();
  const file = await new Promise<File | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(documentId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return file || null;
}

export async function deletePdf(documentId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(documentId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
