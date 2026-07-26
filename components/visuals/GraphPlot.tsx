"use client";
/**
 * Plots y = f(x) from an expression string using mathjs's safe expression
 * parser — never JS eval(). The AI supplies the expression and domain as
 * text (e.g. "x^2 - 4", [-5, 5]); every (x, y) point is then computed by
 * real math, not guessed by the model.
 */
import { useEffect, useRef, useState } from "react";
import type { GraphVisual } from "@/lib/visual-schema";

export function GraphPlot({ visual }: { visual: GraphVisual }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let chart: any;
    let cancelled = false;

    async function render() {
      try {
        const [{ Chart, registerables }, math] = await Promise.all([
          import("chart.js"),
          import("mathjs"),
        ]);
        if (cancelled || !canvasRef.current) return;
        Chart.register(...registerables);

        const compiled = math.compile(visual.expression);
        const [lo, hi] = visual.domain;
        const steps = 60;
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i <= steps; i++) {
          const x = lo + ((hi - lo) * i) / steps;
          let y: number;
          try {
            y = compiled.evaluate({ x });
            if (typeof y !== "number" || !isFinite(y)) continue;
          } catch { continue; }
          points.push({ x, y });
        }
        if (points.length === 0) { setError("Couldn't plot this expression."); return; }

        chart = new Chart(canvasRef.current, {
          type: "line",
          data: {
            datasets: [{
              label: visual.label || `y = ${visual.expression}`,
              data: points,
              borderColor: "#e8a33d",
              backgroundColor: "transparent",
              borderWidth: 2.5,
              pointRadius: 0,
              tension: 0.15,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { type: "linear", grid: { color: "#284134" }, ticks: { color: "#b9c4ba", font: { size: 10 } } },
              y: { grid: { color: "#284134" }, ticks: { color: "#b9c4ba", font: { size: 10 } } },
            },
            plugins: {
              legend: { labels: { color: "#f4f1e8", font: { size: 11 } } },
            },
          },
        });
      } catch (e: any) {
        if (!cancelled) setError("Couldn't plot this expression.");
      }
    }

    render();
    return () => { cancelled = true; chart?.destroy(); };
  }, [visual.expression, visual.domain.join(",")]);

  if (error) {
    return <div className="rounded-lg border border-board3 bg-board p-4 text-xs text-terracotta text-center">{error}</div>;
  }

  return (
    <div className="rounded-lg border border-board3 bg-board p-3" style={{ height: 220 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
