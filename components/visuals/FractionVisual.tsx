"use client";
/**
 * Renders a fraction as a divided bar or pie — purely computed from
 * numerator/denominator, no AI-drawn shapes involved.
 */
import { useEffect, useRef } from "react";
import type { FractionVisual as FractionVisualType } from "@/lib/visual-schema";

export function FractionVisual({ visual }: { visual: FractionVisualType }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { numerator, denominator, style = "bar" } = visual;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Pie radius/center are fixed regardless of canvas height — the
    // canvas is taller than the pie needs purely to give the fraction
    // label below it real breathing room, not to make the pie bigger.
    const pieCx = W / 2, pieCy = 95, pieR = 90;

    if (style === "pie") {
      const sliceAngle = (Math.PI * 2) / denominator;
      for (let i = 0; i < denominator; i++) {
        ctx.beginPath();
        ctx.moveTo(pieCx, pieCy);
        ctx.arc(pieCx, pieCy, pieR, i * sliceAngle - Math.PI / 2, (i + 1) * sliceAngle - Math.PI / 2);
        ctx.closePath();
        ctx.fillStyle = i < numerator ? "#e8a33d" : "#284134";
        ctx.fill();
        ctx.strokeStyle = "#16241d";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else {
      const barW = W - 20, barH = 50, x0 = 10, y0 = H / 2 - barH / 2;
      const segW = barW / denominator;
      for (let i = 0; i < denominator; i++) {
        ctx.fillStyle = i < numerator ? "#e8a33d" : "#284134";
        ctx.fillRect(x0 + i * segW, y0, segW, barH);
        ctx.strokeStyle = "#16241d";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 + i * segW, y0, segW, barH);
      }
    }

    ctx.fillStyle = "#f4f1e8";
    ctx.font = "16px 'Work Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${numerator}/${denominator}`, W / 2, style === "pie" ? pieCy + pieR + 22 : H / 2 + 45);
    ctx.textAlign = "left";
  }, [numerator, denominator, style]);

  return (
    <canvas ref={canvasRef} width={280} height={style === "pie" ? 220 : 140}
      className="mx-auto rounded-lg border border-board3 bg-board" />
  );
}
