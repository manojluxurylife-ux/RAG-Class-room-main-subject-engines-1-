"use client";
/**
 * TextbookPageView — the open textbook page shown alongside the board
 * during a textbook-based class, with the AI teacher's SPOTLIGHT.
 *
 * Rendering: the page is drawn once per page-turn onto a canvas at a
 * fixed pdfjs scale, then displayed at CSS width:100% — so all overlay
 * geometry is stored as PERCENTAGES of the canvas size and stays
 * pixel-accurate at any display width (phone or desktop) with no
 * resize listeners.
 *
 * Spotlight: the lesson JSON now carries verbatim phrases from the page
 * (see the `spotlights` field added to lessonSystemPrompt). This
 * component finds a phrase's position using pdfjs getTextContent() —
 * every text item's transform is mapped through the viewport to a
 * bounding box — then a "torch beam" is drawn with the classic CSS
 * trick: one absolutely-positioned box over the matched lines whose
 * huge box-shadow (0 0 0 9999px) dims everything AROUND it. The rest
 * of the page stays visible but dark, exactly like a teacher dimming
 * the room and shining a torch on one paragraph.
 *
 * Matching is deliberately forgiving: both the page text and the
 * AI-supplied phrase are normalised (lowercase, punctuation and
 * whitespace collapsed — Unicode-aware, so Malayalam/Hindi text matches
 * too), then a sliding window over consecutive text items looks for
 * containment. Scanned PDFs have no text layer, and the model sometimes
 * won't quote perfectly — in both cases the match fails SILENTLY and
 * the page simply shows un-dimmed. A missing spotlight is a shrug;
 * a wrong spotlight would be a lie.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { normalize, findPhraseMatch, boxesToPercentBounds, type TextItemBox, type PctBox } from "@/lib/client/text-spotlight";

type ItemBox = TextItemBox;

interface Props {
  file: File;
  pageNumber: number;          // 1-based
  /** Verbatim phrase from the page to spotlight, or null/"" for none. */
  spotlight?: string | null;
  fallbackRegion?: { x: number; y: number; width: number; height: number };
  laserPointer?: boolean;
}

const RENDER_SCALE = 1.6;      // sharp enough to read on a phone, light enough for 3GB devices

export function TextbookPageView({ file, pageNumber, spotlight, fallbackRegion, laserPointer = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [itemBoxes, setItemBoxes] = useState<ItemBox[]>([]);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [beam, setBeam] = useState<PctBox | null>(null);

  // ── Render the page + collect text-item boxes whenever the page turns ──
  useEffect(() => {
    let cancelled = false;
    async function render() {
      setRendering(true);
      setBeam(null);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const pdf  = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        if (cancelled) { await (pdf as any).destroy?.(); return; }

        const canvas = canvasRef.current;
        if (!canvas) { await (pdf as any).destroy?.(); return; }
        canvas.width  = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport } as any).promise;

        // Text-item bounding boxes in canvas pixels, for spotlight matching.
        const boxes: ItemBox[] = [];
        try {
          const tc = await page.getTextContent();
          for (const item of tc.items as any[]) {
            if (!("str" in item) || !String(item.str).trim()) continue;
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const fontH = Math.hypot(tx[2], tx[3]) || (item.height || 10) * RENDER_SCALE;
            boxes.push({
              str: item.str,
              x: tx[4],
              y: tx[5] - fontH,
              w: (item.width || 0) * RENDER_SCALE,
              h: fontH,
            });
          }
        } catch { /* scanned page, no text layer — spotlight silently unavailable */ }

        if (!cancelled) {
          setItemBoxes(boxes);
          setCanvasSize({ w: canvas.width, h: canvas.height });
        }
        await (pdf as any).destroy?.();
      } catch { /* corrupt page — leave whatever rendered */ }
      if (!cancelled) setRendering(false);
    }
    render();
    return () => { cancelled = true; };
  }, [file, pageNumber]);

  // ── Aim the beam whenever the teacher's spotlight phrase changes ──
  useEffect(() => {
    if (!spotlight || !canvasSize || itemBoxes.length === 0) {
      setBeam(fallbackRegion ? { left:fallbackRegion.x, top:fallbackRegion.y, width:fallbackRegion.width, height:fallbackRegion.height } : null);
      return;
    }
    const matched = findPhraseMatch(itemBoxes, spotlight);
    if (!matched || matched.length === 0) { setBeam(fallbackRegion ? { left:fallbackRegion.x, top:fallbackRegion.y, width:fallbackRegion.width, height:fallbackRegion.height } : null); return; }
    setBeam(boxesToPercentBounds(matched, canvasSize));
  }, [spotlight, itemBoxes, canvasSize, fallbackRegion]);

  return (
    <div className="relative overflow-hidden rounded-t-xl bg-white">
      <canvas ref={canvasRef} className="block w-full h-auto" />
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-board2/80">
          <Loader2 size={20} className="animate-spin text-marigold" />
        </div>
      )}
      {/* Torch beam — the box-shadow dims everything around the match */}
      {beam && !rendering && (
        <div
          className="absolute rounded-md border-2 border-marigold transition-all duration-700 ease-out pointer-events-none"
          style={{
            left:   `${beam.left}%`,
            top:    `${beam.top}%`,
            width:  `${beam.width}%`,
            height: `${beam.height}%`,
            boxShadow: "0 0 0 9999px rgba(10, 16, 12, 0.55), 0 0 24px rgba(232, 163, 61, 0.45)",
          }}
        />
      )}
      {beam && laserPointer && !rendering && (
        <div
          className="absolute h-3.5 w-3.5 rounded-full bg-red-500 pointer-events-none shadow-[0_0_4px_2px_rgba(239,68,68,.8),0_0_18px_8px_rgba(239,68,68,.35)] transition-all duration-700 ease-out"
          style={{ left:`calc(${beam.left + Math.min(beam.width * .82, beam.width - 2)}% - 7px)`, top:`calc(${beam.top + beam.height / 2}% - 7px)` }}
        />
      )}
    </div>
  );
}
