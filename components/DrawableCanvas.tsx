"use client";
/**
 * DrawableCanvas — a small, dependency-free annotation layer.
 *
 * Used in two places in the RAG Classroom redesign:
 *   1. Over the textbook page pane, driven by the top control row's
 *      Pointer / Pen / Highlighter / Eraser tool group.
 *   2. Over the AI Whiteboard pane, driven by its own vertical toolbar
 *      (Select / Pen / Eraser / Text / Shapes / Undo / Redo / Clear).
 *
 * It is intentionally plain <canvas> + pointer events rather than a
 * Konva stage: the AI Whiteboard already renders its auto-written
 * content with react-konva (WhiteboardCommandEngine); layering a
 * second, transparent, freehand-friendly canvas on top keeps that
 * component completely untouched while adding real manual drawing.
 *
 * Honest scope note on the "Select" tool: this is a lightweight
 * annotation layer, not a full vector editor. Select currently acts as
 * a plain cursor/pan mode (no drag-to-move of existing strokes) —
 * building true per-object grab-and-move hit-testing is a separate,
 * considerably larger effort than the rest of this component and was
 * not silently faked here.
 */
import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

export type DrawTool = "select" | "pen" | "highlighter" | "eraser" | "text" | "shape";

type StrokeItem = { kind: "stroke"; tool: "pen" | "highlighter" | "eraser"; color: string; width: number; points: { x: number; y: number }[] };
type ShapeItem  = { kind: "shape"; shape: "rect" | "circle"; color: string; width: number; x: number; y: number; w: number; h: number };
type TextItem   = { kind: "text"; color: string; x: number; y: number; text: string };
type Item = StrokeItem | ShapeItem | TextItem;

export interface DrawableCanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

interface Props {
  tool: DrawTool;
  color: string;
  className?: string;
  /** When false, the canvas ignores pointer events entirely (e.g. the
   *  textbook pane when "Pointer" is selected — plain scroll/click). */
  active: boolean;
  onHistoryChange?: (info: { canUndo: boolean; canRedo: boolean }) => void;
}

export const DrawableCanvas = forwardRef<DrawableCanvasHandle, Props>(function DrawableCanvas(
  { tool, color, className, active, onHistoryChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Item[]>([]);
  const pointerRef = useRef(-1); // index of last "applied" item, for undo/redo
  const drawingRef = useRef(false);
  const currentRef = useRef<StrokeItem | ShapeItem | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  function redraw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const upTo = itemsRef.current.slice(0, pointerRef.current + 1);
    for (const item of upTo) drawItem(ctx, item);
    if (currentRef.current) drawItem(ctx, currentRef.current);
  }

  function drawItem(ctx: CanvasRenderingContext2D, item: Item) {
    if (item.kind === "stroke") {
      if (item.points.length < 2) return;
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = item.width;
      if (item.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = item.tool === "highlighter" ? 0.35 : 1;
        ctx.strokeStyle = item.color;
      }
      ctx.beginPath();
      ctx.moveTo(item.points[0].x, item.points[0].y);
      for (const p of item.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    } else if (item.kind === "shape") {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width;
      ctx.beginPath();
      if (item.shape === "rect") {
        ctx.strokeRect(item.x, item.y, item.w, item.h);
      } else {
        ctx.ellipse(item.x + item.w / 2, item.y + item.h / 2, Math.abs(item.w) / 2, Math.abs(item.h) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = item.color;
      ctx.font = "20px 'Kalam', cursive, sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(item.text, item.x, item.y);
      ctx.restore();
    }
  }

  function pushItem(item: Item) {
    itemsRef.current = itemsRef.current.slice(0, pointerRef.current + 1);
    itemsRef.current.push(item);
    pointerRef.current = itemsRef.current.length - 1;
    reportHistory();
    redraw();
  }

  function reportHistory() {
    onHistoryChange?.({ canUndo: pointerRef.current >= 0, canRedo: pointerRef.current < itemsRef.current.length - 1 });
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (pointerRef.current < 0) return;
      pointerRef.current -= 1;
      reportHistory();
      redraw();
    },
    redo() {
      if (pointerRef.current >= itemsRef.current.length - 1) return;
      pointerRef.current += 1;
      reportHistory();
      redraw();
    },
    clear() {
      itemsRef.current = [];
      pointerRef.current = -1;
      reportHistory();
      redraw();
    },
  }));

  // Keep the backing canvas resolution in sync with its displayed size.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      redraw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent) {
    if (!active || tool === "select") return;
    const p = pos(e);
    if (tool === "text") {
      const text = window.prompt("Text to write on the board:");
      if (text && text.trim()) pushItem({ kind: "text", color, x: p.x, y: p.y, text: text.trim() });
      return;
    }
    drawingRef.current = true;
    if (tool === "shape") {
      currentRef.current = { kind: "shape", shape: "rect", color, width: 3, x: p.x, y: p.y, w: 0, h: 0 };
    } else {
      currentRef.current = {
        kind: "stroke",
        tool: tool as "pen" | "highlighter" | "eraser",
        color,
        width: tool === "eraser" ? 22 : tool === "highlighter" ? 14 : 3,
        points: [p],
      };
    }
    redraw();
  }

  function move(e: React.PointerEvent) {
    if (!drawingRef.current || !currentRef.current) return;
    const p = pos(e);
    if (currentRef.current.kind === "shape") {
      currentRef.current.w = p.x - currentRef.current.x;
      currentRef.current.h = p.y - currentRef.current.y;
    } else {
      currentRef.current.points.push(p);
    }
    redraw();
  }

  function up() {
    if (!drawingRef.current || !currentRef.current) return;
    drawingRef.current = false;
    const item = currentRef.current;
    currentRef.current = null;
    pushItem(item);
  }

  return (
    <div ref={wrapRef} className={className} style={{ position: "absolute", inset: 0 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        style={{
          width: "100%",
          height: "100%",
          touchAction: "none",
          cursor: !active ? "default" : tool === "select" ? "default" : tool === "text" ? "text" : "crosshair",
          pointerEvents: active && tool !== "select" ? "auto" : "none",
        }}
      />
    </div>
  );
});
