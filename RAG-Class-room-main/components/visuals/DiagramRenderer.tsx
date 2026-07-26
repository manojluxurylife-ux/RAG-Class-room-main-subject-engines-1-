"use client";
/**
 * DiagramRenderer — the single entry point the classroom uses to show any
 * AI-requested visual. Validates the shape first (isValidVisual), so a
 * malformed AI output — especially from the weaker offline model — just
 * means "no diagram shown" instead of a crash.
 *
 * Three.js (Solid3DVisual) is dynamically imported here, not statically —
 * it's the heaviest piece and the least commonly needed, so it should
 * never be in the main bundle for a plain fractions lesson.
 */
import dynamic from "next/dynamic";
import type { Visual } from "@/lib/visual-schema";
import { isValidVisual } from "@/lib/visual-schema";
import { GraphPlot } from "./GraphPlot";
import { BarChartVisual } from "./BarChartVisual";
import { GeometryShape } from "./GeometryShape";
import { CircuitDiagram } from "./CircuitDiagram";
import { BiologyDiagramViewer } from "./BiologyDiagramViewer";
import { FractionVisual } from "./FractionVisual";
import { NumberLineVisual } from "./NumberLineVisual";
import { FlowchartVisual } from "./FlowchartVisual";

const SubjectVisual = dynamic(
  () => import("./SubjectVisual").then(m => m.SubjectVisual),
  { ssr: false, loading: () => null },
);
const Solid3DVisual = dynamic(
  () => import("./Solid3DVisual").then(m => m.Solid3DVisual),
  { ssr: false, loading: () => <div className="h-[240px] rounded-lg border border-board3 bg-board animate-pulse" /> },
);

const GeoGebraViewer = dynamic(
  () => import("./GeoGebraViewer").then(m => m.GeoGebraViewer),
  { ssr: false, loading: () => <div className="h-[320px] rounded-lg border border-board3 bg-board animate-pulse" /> },
);

const MoleculeViewer = dynamic(
  () => import("./MoleculeViewer").then(m => m.MoleculeViewer),
  { ssr: false, loading: () => <div className="h-[220px] rounded-lg border border-board3 bg-board animate-pulse" /> },
);

export function DiagramRenderer({ visual }: { visual: unknown }) {
  if (!isValidVisual(visual)) return null;
  const v = visual as Visual;

  switch (v.type) {
    case "graph":       return <GraphPlot visual={v} />;
    case "bar-chart":   return <BarChartVisual visual={v} />;
    case "geometry":    return <GeometryShape visual={v} />;
    case "fraction":    return <FractionVisual visual={v} />;
    case "number-line": return <NumberLineVisual visual={v} />;
    case "flowchart":   return <FlowchartVisual visual={v} />;
    case "solid-3d":    return <Solid3DVisual visual={v} />;
    case "geogebra":    return <GeoGebraViewer visual={v} />;
    case "molecule":    return <MoleculeViewer visual={v} />;
    case "circuit":     return <CircuitDiagram visual={v} />;
    case "biology-diagram": return <BiologyDiagramViewer visual={v} />;
    case "wave": case "ray-diagram": case "force-diagram": case "atom":
    case "chem-equation": case "punnett": case "india-map": case "timeline":
    case "logic-circuit": case "data-structure":
      return <SubjectVisual visual={v} />;
    default:            return null;
  }
}
