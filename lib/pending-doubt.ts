/**
 * When a student highlights part of a study material (notes, slides,
 * flashcards) and asks about it, the selected text needs to reach
 * DoubtCameraMic — which lives in GlobalDoubtDock, mounted once at the
 * student layout root, completely outside the classroom page's component
 * tree. This is the same cross-tree handoff problem textbook-context.ts
 * solved for documentId/topic; this one carries the highlighted excerpt
 * itself plus a request to open the dock and prefill its text input.
 */
const EVENT = "pending-doubt";

export interface PendingDoubt {
  excerpt: string;
  askedAt: string;
}

export const pendingDoubt = {
  ask(excerpt: string) {
    if (typeof window === "undefined") return;
    const detail: PendingDoubt = { excerpt: excerpt.slice(0, 800), askedAt: new Date().toISOString() };
    window.dispatchEvent(new CustomEvent(EVENT, { detail }));
  },

  /** Subscribe to "ask about this" requests. Returns an unsubscribe function. */
  subscribe(cb: (doubt: PendingDoubt) => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (e: Event) => cb((e as CustomEvent).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  },
};
