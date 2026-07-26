"use client";
/**
 * Renders a flowchart from Mermaid syntax. This is deliberately the one
 * case where the AI writes near-final rendering syntax directly, rather
 * than pure numeric parameters — because Mermaid syntax is plain text
 * ("A[Start] --> B{n even?}"), which is a language task, not a spatial
 * one. Small models are meaningfully more reliable at this than at
 * emitting raw SVG coordinates.
 *
 * PREVIOUSLY rendered with the mermaid library; now rendered by our own
 * lib/flowchart-renderer (same grammar subset the prompts generate).
 * WHY the swap: mermaid was 89 MB of build weight — the main cause of
 * out-of-memory production builds on small tiers — and a ~1.4 MB gzipped
 * runtime download on budget phones, triggered often because
 * fallbackVisual() emits flowcharts. The custom renderer is synchronous,
 * a few KB, and keeps the AI-facing "mermaidSyntax" contract unchanged,
 * so stored materials keep rendering identically.
 */
import { useMemo } from "react";
import type { FlowchartVisual as FlowchartVisualType } from "@/lib/visual-schema";
import { renderFlowchartSvg } from "@/lib/flowchart-renderer";

export function FlowchartVisual({ visual }: { visual: FlowchartVisualType }) {
  const { svg, error } = useMemo(() => {
    try {
      // Output is generated locally from parsed tokens with all labels
      // XML-escaped in the renderer, so it is safe to inject.
      return { svg: renderFlowchartSvg(visual.mermaidSyntax), error: "" };
    } catch {
      return { svg: "", error: "Couldn't render this diagram." };
    }
  }, [visual.mermaidSyntax]);

  if (error) {
    return <div className="rounded-lg border border-board3 bg-board p-4 text-xs text-terracotta text-center">{error}</div>;
  }

  return (
    <div
      className="mermaid-visual rounded-lg border border-board3 bg-board p-4 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
