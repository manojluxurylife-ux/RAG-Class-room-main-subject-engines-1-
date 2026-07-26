"use client";
/**
 * Renders a geometric shape from numeric parameters (side lengths, radius,
 * legs) — the drawing math (angle, scale, label placement) is computed
 * here in real code, never by the AI. The AI only ever chooses the shape
 * and supplies numbers.
 */
import { useEffect, useRef } from "react";
import type { GeometryVisual } from "@/lib/visual-schema";

const PAD = 30;

export function GeometryShape({ visual }: { visual: GeometryVisual }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "#e8a33d";
    ctx.fillStyle = "#f4f1e8";
    ctx.font = "13px 'Work Sans', sans-serif";
    ctx.lineWidth = 2.5;

    if (visual.shape === "right-triangle" && visual.legs) {
      const [a, b] = visual.legs;
      const scale = Math.min((W - PAD * 2) / a, (H - PAD * 2) / b);
      const x0 = PAD, y0 = H - PAD;
      const x1 = x0 + a * scale, y1 = y0;
      const x2 = x0, y2 = y0 - b * scale;
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath();
      ctx.stroke();
      // right-angle marker
      ctx.strokeRect(x0, y0 - 12, 12, 12);
      ctx.fillText(visual.labels?.a || `${a}`, (x0 + x1) / 2 - 8, y0 + 18);
      ctx.fillText(visual.labels?.b || `${b}`, x0 - 22, (y0 + y2) / 2);
      const hyp = Math.sqrt(a * a + b * b);
      ctx.fillText(`hyp ≈ ${hyp.toFixed(1)}`, (x1 + x2) / 2, (y1 + y2) / 2 - 6);

    } else if (visual.shape === "triangle" && visual.sides) {
      const [a, b, c] = visual.sides;
      // Place using law of cosines so side lengths are geometrically correct
      const angleC = Math.acos((a * a + b * b - c * c) / (2 * a * b));
      const scale = (W - PAD * 2) / Math.max(a, b, c);
      const x0 = PAD, y0 = H - PAD;
      const x1 = x0 + a * scale, y1 = y0;
      const x2 = x0 + b * scale * Math.cos(angleC);
      const y2 = y0 - b * scale * Math.sin(angleC);
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath();
      ctx.stroke();
      ctx.fillText(`${a}`, (x0 + x1) / 2, y0 + 18);
      ctx.fillText(`${b}`, (x0 + x2) / 2 - 15, (y0 + y2) / 2);
      ctx.fillText(`${c}`, (x1 + x2) / 2 + 5, (y1 + y2) / 2);

    } else if (visual.shape === "circle" && visual.radius) {
      const scale = (Math.min(W, H) - PAD * 2) / (visual.radius * 2);
      const r = visual.radius * scale;
      const cx = W / 2, cy = H / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(cx + r, cy);
      ctx.strokeStyle = "#7fb1cf";
      ctx.stroke();
      ctx.fillStyle = "#7fb1cf";
      ctx.fillText(`r = ${visual.radius}`, cx + r / 2 - 10, cy - 6);

    } else if (visual.shape === "rectangle" && visual.width && visual.height) {
      const scale = Math.min((W - PAD * 2) / visual.width, (H - PAD * 2) / visual.height);
      const w = visual.width * scale, h = visual.height * scale;
      const x0 = (W - w) / 2, y0 = (H - h) / 2;
      ctx.strokeRect(x0, y0, w, h);
      ctx.fillText(`${visual.width}`, x0 + w / 2 - 8, y0 + h + 18);
      // Clamp so the height label never crowds/clips the left edge for
      // wide, width-constrained rectangles (found during audit: x0 can be
      // as small as PAD=30, putting the unclamped label within 10px of
      // the canvas edge).
      ctx.fillText(`${visual.height}`, Math.max(x0 - 20, 6), y0 + h / 2);
    }
  }, [visual]);

  return (
    <canvas ref={canvasRef} width={320} height={220}
      className="mx-auto rounded-lg border border-board3 bg-board" />
  );
}
