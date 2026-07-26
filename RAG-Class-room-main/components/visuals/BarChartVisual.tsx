"use client";
/**
 * Renders categorical data as a bar chart via Chart.js — pure config-driven
 * rendering, the safest pattern in the whole visual layer since the AI just
 * supplies labels and numbers.
 */
import { useEffect, useRef } from "react";
import type { BarChartVisual as BarChartVisualType } from "@/lib/visual-schema";

export function BarChartVisual({ visual }: { visual: BarChartVisualType }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let chart: any;
    let cancelled = false;

    (async () => {
      const { Chart, registerables } = await import("chart.js");
      if (cancelled || !canvasRef.current) return;
      Chart.register(...registerables);
      chart = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: visual.labels,
          datasets: [{ label: visual.label || "", data: visual.values, backgroundColor: "#e8a33d" }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { display: false }, ticks: { color: "#b9c4ba", font: { size: 10 } } },
            y: { grid: { color: "#284134" }, ticks: { color: "#b9c4ba", font: { size: 10 } } },
          },
          plugins: { legend: { display: !!visual.label, labels: { color: "#f4f1e8" } } },
        },
      });
    })();

    return () => { cancelled = true; chart?.destroy(); };
  }, [visual.labels.join(","), visual.values.join(",")]);

  return (
    <div className="rounded-lg border border-board3 bg-board p-3" style={{ height: 220 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
