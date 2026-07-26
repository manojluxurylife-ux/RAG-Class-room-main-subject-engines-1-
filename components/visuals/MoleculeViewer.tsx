"use client";
/**
 * Renders a MoleculeVisual (a SMILES string) as a real chemical
 * structure diagram — bonds, rings, correct atom layout — via
 * smiles-drawer (MIT, peer-reviewed, dependency-free client-side JS).
 * Closes a real gap: Chemistry is one of this app's six supported
 * subjects but had no dedicated visual type at all before this.
 *
 * Safety note, consistent with every other visual type: the AI supplies
 * only a SMILES string — a standard, well-established notation, not
 * coordinates or a drawing. smiles-drawer's own parser rejects anything
 * that isn't valid SMILES, so a malformed string degrades to a clear
 * "could not parse" message rather than rendering something wrong.
 */
import { useEffect, useRef, useState } from "react";
import type { MoleculeVisual } from "@/lib/visual-schema";

export function MoleculeViewer({ visual }: { visual: MoleculeVisual }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    import("smiles-drawer").then((mod) => {
      if (cancelled || !svgRef.current) return;
      const SmilesDrawer = mod.default;
      const drawer = new SmilesDrawer.SmiDrawer({ width: 320, height: 220 });
      drawer.draw(
        visual.smiles.trim(),
        svgRef.current,
        "light",
        undefined,
        () => { if (!cancelled) setError("Could not draw this structure — the chemical notation wasn't valid."); },
      );
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visual.smiles]);

  if (error) {
    return <div className="rounded-lg border border-board3 bg-board p-4 text-xs text-chalkdim">{error}</div>;
  }

  return (
    <div className="rounded-lg border border-board3 bg-board overflow-hidden">
      <svg ref={svgRef} className="block w-full" style={{ minHeight: 220 }} />
      {visual.caption && (
        <div className="border-t border-board3 px-3 py-2 text-xs text-chalkdim">{visual.caption}</div>
      )}
    </div>
  );
}
