import type { Visual } from "./visual-schema";
import { isValidVisual } from "./visual-schema";

export interface VisualizationPhase {
  id?: string;
  title: string;
  narration?: string;
  /** Reveal this phase after this many teaching lines have completed. */
  revealAfterLine?: number;
  /** A deterministic visual specification rendered by the existing library layer. */
  visual: Visual;
}

export interface VisualizationPlan {
  mode: "during-teaching";
  autoplay?: boolean;
  phaseDurationMs?: number;
  phases: VisualizationPhase[];
}

export function isValidVisualizationPlan(value: unknown): value is VisualizationPlan {
  const v = value as any;
  return !!v && v.mode === "during-teaching" && Array.isArray(v.phases) && v.phases.length > 0 &&
    v.phases.length <= 8 && v.phases.every((phase: any) =>
      phase && typeof phase.title === "string" && phase.title.trim().length > 0 &&
      (phase.narration === undefined || typeof phase.narration === "string") &&
      (phase.revealAfterLine === undefined || (Number.isInteger(phase.revealAfterLine) && phase.revealAfterLine >= 0)) &&
      isValidVisual(phase.visual),
    );
}

/** Backward compatibility for materials generated before staged rendering existed. */
export function visualizationPlanFromLegacyVisual(visual: unknown): VisualizationPlan | undefined {
  if (!isValidVisual(visual)) return undefined;
  return {
    mode: "during-teaching",
    autoplay: true,
    phaseDurationMs: 2800,
    phases: [{ title: "Concept visual", revealAfterLine: 1, visual }],
  };
}
