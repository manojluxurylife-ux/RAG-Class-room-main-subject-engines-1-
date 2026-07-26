/**
 * Active-textbook context store.
 *
 * PROBLEM THIS SOLVES: the RAG Classroom (/rag-classroom) and Material
 * Studio (/material-studio) pages both know which ingested PDF
 * (documentId) and topic the student is currently working with — but
 * that state lived only in each page's local useState, so the live
 * voice+camera doubt dock (GlobalDoubtDock -> DoubtCameraMic, mounted
 * once in the student layout) had no way to know about it. The two
 * systems ran side by side without sharing context.
 *
 * FIX: both pages now call textbookContext.set(...) whenever the
 * student picks a document/topic. GlobalDoubtDock reads it on mount and
 * re-reads it on the "textbook-context" event fired below, so the doubt
 * dock always reflects the textbook the student most recently indexed
 * or generated a lesson/material from — even though it lives outside
 * those pages' component trees.
 *
 * Same localStorage-first pattern as lib/student-session.ts: no backend
 * required, one file to swap later if this needs to be server-synced
 * (e.g. multi-device continuity).
 */

const KEY = "gg_active_textbook";
const EVENT = "textbook-context";

export interface TextbookContext {
  documentId: string;
  documentName: string;
  topic?: string;
  /** ISO timestamp — lets consumers ignore stale context if they want to. */
  setAt: string;
}

export const textbookContext = {
  set(ctx: Omit<TextbookContext, "setAt">) {
    if (typeof window === "undefined") return;
    const full: TextbookContext = { ...ctx, setAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(full));
    // storage event only fires in OTHER tabs, not this one — dispatch our
    // own so GlobalDoubtDock updates immediately in the same tab/session.
    window.dispatchEvent(new CustomEvent(EVENT, { detail: full }));
  },

  get(): TextbookContext | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
  },

  /** Subscribe to same-tab changes. Returns an unsubscribe function. */
  subscribe(cb: (ctx: TextbookContext | null) => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (e: Event) => cb((e as CustomEvent).detail ?? null);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  },
};
