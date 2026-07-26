/**
 * Remembers, per documentId, where the student left off in a classroom
 * session — which scene of the lesson they were on, and which material
 * tab (slides/flashcards/quizzes) was last open. Read when a textbook
 * card is clicked so class "resumes" instead of restarting from scene 0
 * every time.
 */
const KEY_PREFIX = "gg_classroom_progress:";

export interface ClassroomProgress {
  documentId: string;
  topic?: string;
  scene?: number;
  /** PDF page synchronized with the active teaching scene. */
  page?: number;
  activeTab?: string;
  /** The full generated lesson, cached so reopening a textbook resumes
   *  instantly instead of re-calling Gemini for the same topic. */
  lesson?: any;
  updatedAt: string;
}

export const classroomProgress = {
  set(documentId: string, patch: Partial<Omit<ClassroomProgress, "documentId" | "updatedAt">>) {
    if (typeof window === "undefined") return;
    const existing = classroomProgress.get(documentId);
    const next: ClassroomProgress = { documentId, ...existing, ...patch, updatedAt: new Date().toISOString() };

    // Safer stringify to avoid circular reference/React node serialization errors
    const safeStringify = (obj: any) => {
      const cache = new Set();
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          // Omit circular references
          if (cache.has(value)) return undefined;
          // Omit React elements or DOM nodes
          if (value.$$typeof && typeof value.$$typeof === 'symbol') return undefined;
          if (value.nodeType && typeof value.nodeType === 'number') return undefined;
          cache.add(value);
        }
        return value;
      });
    };

    try {
      localStorage.setItem(KEY_PREFIX + documentId, safeStringify(next));
    } catch (e) {
      console.error("Failed to save classroom progress", e);
      localStorage.removeItem(KEY_PREFIX + documentId);
    }
  },

  get(documentId: string): ClassroomProgress | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(KEY_PREFIX + documentId);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  remove(documentId: string) {
    if (typeof window === "undefined") return;
    localStorage.removeItem(KEY_PREFIX + documentId);
  },
};
