"use client";
/**
 * Renders a CircuitVisual as a real schoolbook-style circuit diagram —
 * standard symbols (zigzag resistor, long/short-line battery, circled
 * meter letters), drawn deterministically from the component list. The
 * AI never supplies coordinates or drawing instructions, only which
 * components appear and in what order — same principle as every other
 * Canvas-based visual (GeometryShape, FractionVisual, NumberLineVisual).
 *
 * Layout: a simple rectangular series loop. All components sit along
 * the top edge, evenly spaced; the right, bottom, and left edges are
 * plain connecting wire, closing the loop — this is exactly how CBSE
 * textbooks draw a simple series circuit (e.g. the Ohm's Law
 * verification circuit already curated in lib/lab-kb.ts).
 */
import { useEffect, useRef } from "react";
import type { CircuitVisual, CircuitComponent } from "@/lib/visual-schema";

const PAD = 36;
const STROKE = "#e8a33d";
const TEXT = "#f4f1e8";

function drawBattery(ctx: CanvasRenderingContext2D, cx: number, cy: number, label?: string) {
  // Long thin line (+) and short thick line (–), side by side, standard schoolbook symbol.
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 4, cy - 14); ctx.lineTo(cx - 4, cy + 14); ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx + 4, cy - 7); ctx.lineTo(cx + 4, cy + 7); ctx.stroke();
  ctx.lineWidth = 2.5;
  if (label) ctx.fillText(label, cx - 10, cy - 22);
}

function drawResistor(ctx: CanvasRenderingContext2D, x0: number, x1: number, cy: number, label?: string) {
  const segments = 6;
  const step = (x1 - x0) / segments;
  const amp = 9;
  ctx.beginPath();
  ctx.moveTo(x0, cy);
  for (let i = 0; i < segments; i++) {
    const x = x0 + step * (i + 0.5);
    ctx.lineTo(x, cy + (i % 2 === 0 ? -amp : amp));
  }
  ctx.lineTo(x1, cy);
  ctx.stroke();
  if (label) ctx.fillText(label, x0 + (x1 - x0) / 2 - 6, cy - amp - 8);
}

function drawSwitch(ctx: CanvasRenderingContext2D, x0: number, x1: number, cy: number, open?: boolean) {
  ctx.beginPath(); ctx.arc(x0, cy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x1, cy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x0, cy);
  if (open) ctx.lineTo(x1 - (x1 - x0) * 0.25, cy - 14); // lever raised — circuit open
  else ctx.lineTo(x1, cy);                              // lever flat — circuit closed
  ctx.stroke();
}

function drawMeter(ctx: CanvasRenderingContext2D, cx: number, cy: number, letter: string) {
  ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fillStyle = "#1a2420"; ctx.fill(); ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.fillText(letter, cx - 4, cy + 4);
}

function drawBulb(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fillStyle = "#1a2420"; ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8);
  ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8);
  ctx.stroke();
}

function componentLabel(c: CircuitComponent): string {
  if (c.label) return c.label;
  return { battery: "", resistor: "R", switch: "", ammeter: "A", voltmeter: "V", bulb: "" }[c.kind];
}

export function CircuitDiagram({ visual }: { visual: CircuitVisual }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = STROKE;
    ctx.fillStyle = TEXT;
    ctx.font = "13px 'Work Sans', sans-serif";
    ctx.lineWidth = 2.5;

    const top = PAD, bottom = H - PAD, left = PAD, right = W - PAD;
    const n = visual.components.length;
    const slotWidth = (right - left) / n;

    // Return path — right, bottom, left edges (the top edge is drawn
    // in per-component segments below, since components interrupt it).
    ctx.beginPath();
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.lineTo(left, top);
    ctx.stroke();

    visual.components.forEach((comp, i) => {
      const slotStart = left + slotWidth * i;
      const slotEnd = left + slotWidth * (i + 1);
      const cx = (slotStart + slotEnd) / 2;
      const leadIn = slotStart + slotWidth * 0.18;
      const leadOut = slotEnd - slotWidth * 0.18;

      // Wire leading into and out of this component's symbol
      ctx.beginPath();
      ctx.moveTo(slotStart, top); ctx.lineTo(leadIn, top);
      ctx.moveTo(leadOut, top); ctx.lineTo(slotEnd, top);
      ctx.stroke();

      const label = componentLabel(comp);
      switch (comp.kind) {
        case "battery":   drawBattery(ctx, cx, top, label);            break;
        case "resistor":  drawResistor(ctx, leadIn, leadOut, top, label); break;
        case "switch":    drawSwitch(ctx, leadIn, leadOut, top, comp.open); break;
        case "ammeter":   drawMeter(ctx, cx, top, "A");                 break;
        case "voltmeter": drawMeter(ctx, cx, top, "V");                 break;
        case "bulb":      drawBulb(ctx, cx, top);                      break;
      }
      ctx.strokeStyle = STROKE;
      ctx.fillStyle = TEXT;
    });
  }, [visual]);

  return (
    <div className="rounded-lg border border-board3 bg-board overflow-hidden">
      <canvas ref={canvasRef} width={420} height={200} className="block w-full" />
      {visual.caption && (
        <div className="border-t border-board3 px-3 py-2 text-xs text-chalkdim">{visual.caption}</div>
      )}
    </div>
  );
}
