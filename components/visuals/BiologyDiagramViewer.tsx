"use client";
/**
 * Renders a BiologyDiagramVisual by looking up the AI-selected id in
 * the curated, hand-authored library (lib/biology-diagrams.ts) — the
 * SVG itself is never AI-generated, only the choice of which real,
 * pre-verified diagram to show. If the AI supplies an id that isn't in
 * the curated set (e.g. a hallucinated id, or a topic with no matching
 * diagram yet), this shows nothing rather than guessing — the same
 * "degrade gracefully, never render something wrong" principle as
 * every other visual type's validation.
 */
import { findBiologyDiagram } from "@/lib/biology-diagrams";
import type { BiologyDiagramVisual } from "@/lib/visual-schema";

export function BiologyDiagramViewer({ visual }: { visual: BiologyDiagramVisual }) {
  const diagram = findBiologyDiagram(visual.diagramId);
  if (!diagram) return null;

  return (
    <div className="rounded-lg border border-board3 bg-board overflow-hidden">
      {/* dangerouslySetInnerHTML is genuinely safe here specifically:
          diagram.svg always comes from our own two hardcoded strings in
          lib/biology-diagrams.ts — never from the AI or any user input.
          The AI only ever supplies diagramId (a plain string looked up
          above), never the SVG markup itself. */}
      <div
        className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
        dangerouslySetInnerHTML={{ __html: diagram.svg }}
      />
      <div className="border-t border-board3 px-3 py-2.5">
        <div className="mb-1.5 text-xs font-medium text-chalk">{diagram.name}</div>
        <ul className="flex flex-col gap-0.5">
          {diagram.parts.map(p => (
            <li key={p.number} className="text-[11px] text-chalkdim">
              <span className="font-mono text-marigold">{p.number}</span> — {p.name}
            </li>
          ))}
        </ul>
        {visual.caption && <div className="mt-1.5 text-xs text-chalkdim">{visual.caption}</div>}
      </div>
    </div>
  );
}
