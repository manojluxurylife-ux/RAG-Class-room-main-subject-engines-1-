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

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

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
  const dragState = useRef<{ mode: "move" | "resize"; dir?: ResizeDir; startX: number; startY: number; startRect: PanelRect } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, mode: "move" | "resize", dir?: ResizeDir) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { mode, dir, startX: e.clientX, startY: e.clientY, startRect: rect };
    onFocus(id);
  }, [id, rect, onFocus]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragState.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    let next: PanelRect;
    if (drag.mode === "move") {
      next = { ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy };
    } else {
      // Resize from whichever edge/corner was grabbed — "e"/"s" only
      // grow the dimension itself (same as the original bottom-right-
      // only behaviour); "w"/"n" ALSO have to shift x/y as they resize,
      // since dragging a panel's LEFT edge changes both its width and
      // its left position (the right edge stays put), same idea for
      // the top edge. Previously only "se" existed at all — if a panel
      // grew tall enough that its bottom-right corner ended up below
      // the visible canvas, there was no other way to shrink it back;
      // every edge and corner is now a working grab point, so at least
      // one is always reachable regardless of which direction a panel
      // grew.
      const dir = drag.dir || "se";
      let { x, y, w, h } = drag.startRect;
      if (dir.includes("e")) w = drag.startRect.w + dx;
      if (dir.includes("s")) h = drag.startRect.h + dy;
      if (dir.includes("w")) { w = drag.startRect.w - dx; x = drag.startRect.x + dx; }
      if (dir.includes("n")) { h = drag.startRect.h - dy; y = drag.startRect.y + dy; }
      next = { x, y, w, h, z: drag.startRect.z };
    }
    onRectChange(id, clampRectToCanvas(next, canvasSize));
  }, [id, canvasSize, onRectChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragState.current) (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragState.current = null;
  }, []);

  if (!floatingEnabled) {
    return <div className={staticClassName}>{children}</div>;
  }

  const cursorFor: Record<ResizeDir, string> = {
    n: "cursor-ns-resize", s: "cursor-ns-resize",
    e: "cursor-ew-resize", w: "cursor-ew-resize",
    ne: "cursor-nesw-resize", sw: "cursor-nesw-resize",
    nw: "cursor-nwse-resize", se: "cursor-nwse-resize",
  };
  // Edge strips: thin along the straight sides (easy to hit without
  // covering much interior content), a bigger square at the corners
  // (easier to grab precisely for diagonal resizing). Every one calls
  // the exact same handlers, just with a different `dir`.
  const edge = (dir: ResizeDir, style: React.CSSProperties) => (
    <div
      key={dir}
      onPointerDown={(e) => handlePointerDown(e, "resize", dir)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute touch-none ${cursorFor[dir]}`}
      style={style}
      title={`Drag to resize (${dir})`}
    />
  );

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

      {/* Straight edges — thin strips along each side. */}
      {edge("n", { top: -3, left: 12, right: 12, height: 7 })}
      {edge("s", { bottom: -3, left: 12, right: 12, height: 7 })}
      {edge("w", { left: -3, top: 12, bottom: 12, width: 7 })}
      {edge("e", { right: -3, top: 12, bottom: 12, width: 7 })}
      {/* Corners — small squares, positioned to overlap the adjacent
          edge strips so there's no dead zone right at a corner. */}
      {edge("nw", { top: -3, left: -3, width: 16, height: 16 })}
      {edge("ne", { top: -3, right: -3, width: 16, height: 16 })}
      {edge("sw", { bottom: -3, left: -3, width: 16, height: 16 })}

      {/* Bottom-right corner keeps its original, more visible chip —
          the primary, most-discoverable resize affordance — with the
          same "se" resize behaviour as before. */}
      <div
        onPointerDown={(e) => handlePointerDown(e, "resize", "se")}
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
