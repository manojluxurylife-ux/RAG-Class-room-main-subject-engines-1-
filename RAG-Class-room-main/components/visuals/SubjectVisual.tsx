"use client";
/**
 * Renders the Volume 3-8 subject visuals (Physics/Chemistry/Biology/
 * Geography/History/CS) from lib/subject-visuals.ts — all synchronous
 * SVG-string renderers, so this component is tiny. The one async case
 * is india-map, whose state path data (@svg-maps/india, ~380 KB raw)
 * is imported on demand so it never rides in the page bundle.
 */
import { useEffect, useMemo, useState } from "react";
import type { Visual } from "@/lib/visual-schema";
import {
  renderWave, renderRayDiagram, renderForceDiagram, renderAtom,
  renderChemEquation, renderPunnett, renderIndiaMap, renderTimeline,
  renderLogicCircuit, renderDataStructure, type IndiaMapData,
} from "@/lib/subject-visuals";

const FAIL = <div className="rounded-lg border border-board3 bg-board p-4 text-xs text-terracotta text-center">Couldn&apos;t render this diagram.</div>;

function Svg({ svg }: { svg: string }) {
  return (
    <div
      className="subject-visual rounded-lg border border-board3 bg-board p-4 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function IndiaMapVisual({ visual }: { visual: any }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod: any = await import("@svg-maps/india");
        const data: IndiaMapData = mod.default || mod;
        if (!cancelled) setSvg(renderIndiaMap(data, visual));
      } catch { if (!cancelled) setError(true); }
    })();
    return () => { cancelled = true; };
  }, [visual]);
  if (error) return FAIL;
  if (!svg) return <div className="rounded-lg border border-board3 bg-board p-4 text-xs text-chalkdim text-center">Loading map…</div>;
  return <Svg svg={svg} />;
}

export function SubjectVisual({ visual }: { visual: Visual }) {
  const v = visual as any;
  const { svg, error } = useMemo(() => {
    try {
      switch (v.type) {
        case "wave":           return { svg: renderWave(v), error: false };
        case "ray-diagram":    return { svg: renderRayDiagram(v), error: false };
        case "force-diagram":  return { svg: renderForceDiagram(v), error: false };
        case "atom":           return { svg: renderAtom(v), error: false };
        case "chem-equation":  return { svg: renderChemEquation(v), error: false };
        case "punnett":        return { svg: renderPunnett(v), error: false };
        case "timeline":       return { svg: renderTimeline(v), error: false };
        case "logic-circuit":  return { svg: renderLogicCircuit(v), error: false };
        case "data-structure": return { svg: renderDataStructure(v), error: false };
        default:               return { svg: "", error: false };
      }
    } catch { return { svg: "", error: true }; }
  }, [v]);

  if (v.type === "india-map") return <IndiaMapVisual visual={v} />;
  if (error) return FAIL;
  if (!svg) return FAIL;
  return <Svg svg={svg} />;
}
