import { safeStringify } from "@/lib/safe-storage";

/**
 * Pure layout math behind RAG Classroom's draggable floating panels
 * (PDF+thumbnails, AI Notes, Whiteboard). Kept dependency-free and
 * separate from the React drag-handling component so the actual
 * positioning logic — clamping, default layout, persistence shape —
 * is independently testable without a browser.
 */
export interface PanelRect { x: number; y: number; w: number; h: number; z: number }
export type PanelLayout = Record<string, PanelRect>;

const STORAGE_KEY = "gg_classroom_panel_layout_v1";
export const MIN_PANEL_W = 260;
export const MIN_PANEL_H = 200;
/** How much of a panel must stay reachable on screen — prevents a
 *  student from dragging a panel fully off-screen and losing it with
 *  no way to get it back short of resetting the whole layout. */
const MIN_VISIBLE_PX = 48;

/**
 * A sensible starting arrangement: three panels side by side, filling
 * the given canvas size, matching the proportions the original static
 * grid used (PDF and Notes roughly equal, Whiteboard slightly wider).
 */
export function defaultPanelLayout(canvas: { w: number; h: number }): PanelLayout {
  const gap = 12;
  const colW = Math.max(MIN_PANEL_W, Math.floor((canvas.w - gap * 2) / 3));
  const h = Math.max(MIN_PANEL_H, canvas.h);
  return {
    textbook:  { x: 0,                    y: 0, w: colW, h, z: 1 },
    notes:     { x: colW + gap,           y: 0, w: colW, h, z: 1 },
    whiteboard:{ x: (colW + gap) * 2,     y: 0, w: colW, h, z: 1 },
  };
}

/**
 * Keeps a rect within reach of the given canvas — a panel can be
 * dragged mostly off either edge (so it can be tucked out of the way),
 * but never so far that MIN_VISIBLE_PX of it is unreachable. Size is
 * clamped to the panel's own minimums and to no larger than the canvas
 * itself, so a panel can never be resized into something the student
 * can't see all the controls of, or bigger than the screen has room for.
 */
export function clampRectToCanvas(rect: PanelRect, canvas: { w: number; h: number }): PanelRect {
  const w = Math.max(MIN_PANEL_W, Math.min(rect.w, Math.max(MIN_PANEL_W, canvas.w)));
  const h = Math.max(MIN_PANEL_H, Math.min(rect.h, Math.max(MIN_PANEL_H, canvas.h)));
  const minX = MIN_VISIBLE_PX - w;
  const maxX = canvas.w - MIN_VISIBLE_PX;
  const minY = 0; // never let the title bar (needed to drag it back) go above the visible top
  const maxY = canvas.h - MIN_VISIBLE_PX;
  return {
    ...rect,
    w, h,
    x: Math.min(Math.max(rect.x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(rect.y, minY), Math.max(minY, maxY)),
  };
}

/** Raises one panel above all the others — the one just clicked or
 *  dragged should always be on top, matching how every real window
 *  manager behaves. */
export function bringToFront(layout: PanelLayout, id: string): PanelLayout {
  if (!layout[id]) return layout;
  const maxZ = Math.max(0, ...Object.values(layout).map(r => r.z));
  if (layout[id].z === maxZ && Object.values(layout).filter(r => r.z === maxZ).length === 1) return layout;
  return { ...layout, [id]: { ...layout[id], z: maxZ + 1 } };
}

export function loadPanelLayout(): PanelLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null; // corrupted/foreign data — treat as "no saved layout", never crash the page over it
  }
}

export function savePanelLayout(layout: PanelLayout): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, safeStringify(layout)); } catch { /* storage full/unavailable — layout just won't persist this time */ }
}

export function resetPanelLayout(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
