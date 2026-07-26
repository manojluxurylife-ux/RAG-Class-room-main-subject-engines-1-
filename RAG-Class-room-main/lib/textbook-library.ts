"use client";
/**
 * textbook-library — the student's own bookshelf, stored ON DEVICE in
 * IndexedDB (not localStorage — a textbook PDF is tens of MB, far past
 * the ~5 MB localStorage limit; IndexedDB stores ArrayBuffers natively).
 *
 * Why on-device and not Firestore/GCS: this matches the app's standing
 * offline-first principle — a student's textbook never needs to leave
 * their phone for the app to teach from it, there is zero recurring
 * storage cost, and it keeps working with no internet once the lesson
 * generation itself has an offline path. The trade-off is honest and
 * acceptable: the shelf is per-device (a book uploaded on the phone
 * isn't on the school computer). Records are keyed to the student's
 * email so siblings sharing one device each see only their own shelf.
 *
 * `lastPageTaught` is the resume pointer: the next class on a book
 * starts at lastPageTaught + 1 — textbook-based teaching that moves
 * forward page by page, like a real teacher continuing from where the
 * last period stopped. Progress only ever moves FORWARD (Math.max) so
 * a student flipping back to revise an old page never loses their place.
 */

export interface TextbookMeta {
  id: string;
  student: string;        // student email — shelf isolation on shared devices
  name: string;           // file name, shown on the shelf
  totalPages: number;
  lastPageTaught: number; // 0 = never taught; next class starts at this + 1
  addedAt: number;
  // Filled in by the Study Materials form when the book is uploaded —
  // optional so books added before this form existed keep working.
  syllabus?:  string;     // "cbse" | "kerala" | ...
  className?: string;     // "1".."12"
  subject?:   string;     // from STUDY_SUBJECTS
  language?:  string;     // language the BOOK itself is printed in
}

export interface TextbookFormMeta {
  syllabus:  string;
  className: string;
  subject:   string;
  language:  string;
}

interface TextbookRecord extends TextbookMeta {
  data: ArrayBuffer;      // the PDF bytes themselves
}

const DB_NAME    = "gg-textbook-library";
const DB_VERSION = 1;
const STORE      = "books";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("student", "student", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const t   = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
    t.oncomplete  = () => db.close();
  }));
}

export const textbookLibrary = {
  /** All of THIS student's books, newest first, without the heavy PDF bytes. */
  async list(student: string): Promise<TextbookMeta[]> {
    try {
      const all = await tx<TextbookRecord[]>("readonly", s => s.index("student").getAll(student));
      return (all || [])
        .map(({ data: _drop, ...meta }) => meta)
        .sort((a, b) => b.addedAt - a.addedAt);
    } catch {
      return []; // IndexedDB unavailable (rare, e.g. some private modes) — empty shelf, app still works
    }
  },

  async add(student: string, file: File, totalPages: number, form?: TextbookFormMeta): Promise<TextbookMeta> {
    const data = await file.arrayBuffer();
    const rec: TextbookRecord = {
      id: `tb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      student,
      name: file.name.replace(/\.pdf$/i, ""),
      totalPages,
      lastPageTaught: 0,
      addedAt: Date.now(),
      ...(form || {}),
      data,
    };
    await tx("readwrite", s => s.put(rec));
    const { data: _drop, ...meta } = rec;
    return meta;
  },

  /** Rebuild a File from the stored bytes for pdfjs / teaching calls. */
  async getFile(id: string): Promise<File | null> {
    try {
      const rec = await tx<TextbookRecord | undefined>("readonly", s => s.get(id));
      if (!rec) return null;
      return new File([rec.data], `${rec.name}.pdf`, { type: "application/pdf" });
    } catch {
      return null;
    }
  },

  /** Forward-only progress: revising an earlier page never loses the place. */
  async markPageTaught(id: string, page: number): Promise<void> {
    try {
      const rec = await tx<TextbookRecord | undefined>("readonly", s => s.get(id));
      if (!rec) return;
      rec.lastPageTaught = Math.max(rec.lastPageTaught || 0, page);
      await tx("readwrite", s => s.put(rec));
    } catch { /* progress is a convenience — never block the lesson on it */ }
  },

  async remove(id: string): Promise<void> {
    try { await tx("readwrite", s => s.delete(id)); } catch { /* already gone */ }
  },
};
