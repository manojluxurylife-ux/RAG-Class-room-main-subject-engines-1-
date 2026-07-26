"use client";
/**
 * A single draggable, resizable floating panel — used three times in
 * RAG Classroom (PDF+thumbnails, AI Notes, Whiteboard) to let a student
 * pick up and move any of them anywhere on screen.
 *
 * Two modes, controlled by `floatingEnabled`:
 *  - false: renders as a plain, normal in-flow element using
 *    `staticClassName` — EXACTLY the original static grid layout, byte
 *    for byte the same markup shape as before this feature existed.
 *    Used on narrow screens (see the floatingEnabled computation in
 *    app/(student)/rag-classroom/page.tsx) — free-floating windows are
 *    a genuinely poor fit for a small touchscreen, so this app
 *    deliberately keeps the safe, proven layout there rather than
 *    forcing the new one everywhere regardless of screen size.
 *  - true: renders as an absolutely-positioned, draggable/resizable
 *    window within the shared floating canvas.
 *
 * Dragging is restricted to the title bar specifically (not the whole
 * panel), so nothing inside — buttons, the PDF thumbnails, the
 * whiteboard's own canvas — has its normal interactions taken over by
 * a drag gesture starting somewhere it shouldn't.
 */
import { useCallback, useRef } from "react";
import { GripHorizontal } from "lucide-react";
import { clampRectToCanvas, type PanelRect } from "@/lib/client/panel-layout";

interface FloatingPanelProps {
  id: string;
  title: string;
  floatingEnabled: boolean;
  rect: PanelRect;
  canvasSize: { w: number; h: number };
  onRectChange: (id: string, rect: PanelRect) => void;
  onFocus: (id: string) => void;
  staticClassName: string;
  children: React.ReactNode;
}

export function FloatingPanel({ id, title, floatingEnabled, rect, canvasSize, onRectChange, onFocus, staticClassName, children }: FloatingPanelProps) {
  const dragState = useRef<{ mode: "move" | "resize"; startX: number; startY: number; startRect: PanelRect } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, mode: "move" | "resize") => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { mode, startX: e.clientX, startY: e.clientY, startRect: rect };
    onFocus(id);
  }, [id, rect, onFocus]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragState.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const next: PanelRect = drag.mode === "move"
      ? { ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy }
      : { ...drag.startRect, w: drag.startRect.w + dx, h: drag.startRect.h + dy };
    onRectChange(id, clampRectToCanvas(next, canvasSize));
  }, [id, canvasSize, onRectChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragState.current) (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragState.current = null;
  }, []);

  if (!floatingEnabled) {
    return <div className={staticClassName}>{children}</div>;
  }

  return (
    <div
      onPointerDown={() => onFocus(id)}
      style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: rect.z }}
      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-board3 bg-board2 shadow-2xl"
    >
      <div
        onPointerDown={(e) => handlePointerDown(e, "move")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="group flex shrink-0 cursor-grab touch-none items-center gap-2 border-b border-board3 bg-board px-3 py-2.5 text-xs font-semibold text-chalkdim transition-colors hover:bg-board3/60 active:cursor-grabbing active:bg-board3"
        title="Drag to move"
      >
        <GripHorizontal size={18} className="shrink-0 text-chalkdim/70 transition-colors group-hover:text-amber" />
        <span className="truncate">{title}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      {/* A 20px hit-target here was easy to miss entirely — this is a
          much bigger, visually distinct corner grip (rounded chip with
          a hover highlight) so it actually reads as "grab this to
          resize" instead of blending into the panel border. */}
      <div
        onPointerDown={(e) => handlePointerDown(e, "resize")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="group absolute bottom-0 right-0 flex h-9 w-9 cursor-nwse-resize touch-none items-end justify-end p-1.5"
        title="Drag to resize"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-tl-lg rounded-br-2xl bg-board3/80 transition-colors group-hover:bg-amber/80 group-active:bg-amber">
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-chalkdim group-hover:text-board group-active:text-board"><path d="M14 2 2 14M14 8 8 14M14 14h.01" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
        </div>
      </div>
    </div>
  );
}
