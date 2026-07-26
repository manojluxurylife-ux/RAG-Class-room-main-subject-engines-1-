"use client";
/**
 * Renders a number line with marked points — tick spacing computed from
 * min/max, point positions computed from their value. No coordinate
 * hallucination possible since positions are pure arithmetic.
 */
import { useEffect, useRef } from "react";
import type { NumberLineVisual as NumberLineVisualType } from "@/lib/visual-schema";

export function NumberLineVisual({ visual }: { visual: NumberLineVisualType }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Guard against a degenerate range (min === max, or max < min) — dividing
  // by (max - min) in toX() below would produce NaN/Infinity positions,
  // silently rendering nothing rather than crashing. isValidVisual() only
  // checks these are numbers, not that they form a valid range, so this
  // needs its own defensive check.
  const { min: rawMin, max: rawMax, points } = visual;
  const min = rawMin;
  const max = rawMax > rawMin ? rawMax : rawMin + 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const PAD = 24;
    ctx.clearRect(0, 0, W, H);

    const y = H / 2;
    const toX = (v: number) => PAD + ((v - min) / (max - min)) * (W - PAD * 2);

    ctx.strokeStyle = "#b9c4ba";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();

    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#b9c4ba";
    ctx.textAlign = "center";
    const step = Math.max(1, Math.round((max - min) / 10));
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
      const x = toX(v);
      ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
      ctx.fillText(String(v), x, y + 20);
    }

    points.forEach(p => {
      const x = toX(p.value);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#e8a33d";
      ctx.fill();
      if (p.label) {
        ctx.fillStyle = "#f4f1e8";
        ctx.font = "12px 'Work Sans', sans-serif";
        ctx.fillText(p.label, x, y - 14);
      }
    });
    ctx.textAlign = "left";
  }, [min, max, points]);

  return (
    <canvas ref={canvasRef} width={320} height={90}
      className="mx-auto rounded-lg border border-board3 bg-board" />
  );
}
