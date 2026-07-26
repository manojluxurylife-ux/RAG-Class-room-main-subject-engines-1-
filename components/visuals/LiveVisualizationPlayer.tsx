"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { DiagramRenderer } from "./DiagramRenderer";
import { isValidVisualizationPlan, visualizationPlanFromLegacyVisual, type VisualizationPlan } from "@/lib/visualization-plan";

interface Props {
  plan?: unknown;
  legacyVisual?: unknown;
  completedTeachingLines: number;
}

export function LiveVisualizationPlayer({ plan, legacyVisual, completedTeachingLines }: Props) {
  const resolved = useMemo<VisualizationPlan | undefined>(() =>
    isValidVisualizationPlan(plan) ? plan : visualizationPlanFromLegacyVisual(legacyVisual),
  [plan, legacyVisual]);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const unlockedCount = useMemo(() => {
    if (!resolved) return 0;
    return resolved.phases.filter((p, i) => completedTeachingLines >= (p.revealAfterLine ?? i)).length;
  }, [resolved, completedTeachingLines]);

  useEffect(() => {
    setPhaseIndex(0);
    setPlaying(resolved?.autoplay !== false);
  }, [resolved]);

  useEffect(() => {
    if (!resolved || !playing || unlockedCount <= 1) return;
    const maxIndex = Math.max(0, unlockedCount - 1);
    if (phaseIndex >= maxIndex) return;
    const timer = window.setTimeout(() => setPhaseIndex(i => Math.min(i + 1, maxIndex)), resolved.phaseDurationMs ?? 2800);
    return () => window.clearTimeout(timer);
  }, [resolved, playing, phaseIndex, unlockedCount]);

  if (!resolved || unlockedCount === 0) return null;
  const maxIndex = Math.max(0, unlockedCount - 1);
  const safeIndex = Math.min(phaseIndex, maxIndex);
  const phase = resolved.phases[safeIndex];

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-blue/30 bg-board/60" aria-label="Live visualization">
      <div className="flex items-center justify-between border-b border-board3 px-3 py-2">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-blue">Live board visual</div>
          <div className="text-sm font-semibold text-chalk">{phase.title}</div>
        </div>
        <div className="font-mono text-[9px] text-chalkdim">{safeIndex + 1}/{resolved.phases.length}</div>
      </div>

      <div className="p-3">
        <DiagramRenderer visual={phase.visual} />
        {phase.narration && <p className="mt-2 text-xs leading-relaxed text-chalkdim">{phase.narration}</p>}
      </div>

      <div className="flex items-center justify-between border-t border-board3 px-3 py-2">
        <button type="button" onClick={() => setPhaseIndex(i => Math.max(0, i - 1))} disabled={safeIndex === 0}
          className="rounded p-1.5 text-chalkdim hover:text-chalk disabled:opacity-30" aria-label="Previous drawing phase">
          <ChevronLeft size={15}/>
        </button>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => { setPhaseIndex(0); setPlaying(false); }} className="rounded p-1.5 text-chalkdim hover:text-chalk" aria-label="Restart visualization"><RotateCcw size={14}/></button>
          <button type="button" onClick={() => setPlaying(p => !p)} className="inline-flex items-center gap-1 rounded-md border border-board3 px-2.5 py-1 text-[10px] text-chalkdim hover:text-chalk">
            {playing ? <Pause size={12}/> : <Play size={12}/>} {playing ? "Pause" : "Play"}
          </button>
        </div>
        <button type="button" onClick={() => setPhaseIndex(i => Math.min(maxIndex, i + 1))} disabled={safeIndex >= maxIndex}
          className="rounded p-1.5 text-chalkdim hover:text-chalk disabled:opacity-30" aria-label="Next drawing phase">
          <ChevronRight size={15}/>
        </button>
      </div>
    </section>
  );
}
