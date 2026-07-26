"use client";
/**
 * WhiteboardCanvas — real canvas-drawn board for the RAG Classroom scene
 * player, replacing the plain bullet-point <p> list that used to stand
 * in for a "blackboard". Built on Konva (konvajs/konva + react-konva),
 * suggested by the user for exactly this gap.
 *
 * WHY KONVA HERE: react-konva gives declarative React components
 * (<Stage>/<Layer>/<Text>/<Rect>) on top of the HTML5 canvas, which is
 * the standard building block for whiteboard/annotation apps — you
 * don't hand-roll canvas imperative calls, you just describe what
 * should be on the board and Konva reconciles it, same mental model as
 * regular React DOM rendering.
 *
 * WHAT IT DOES: takes a lesson scene's `board: string[]` bullets (from
 * /api/rag/lesson or /api/material-studio/generate) and reveals each
 * line character-by-character, like it's being handwritten in real
 * time, using the app's existing Kalam display font (already loaded
 * globally in app/globals.css — see the @import at the top of that
 * file — so no extra font loading is introduced here). A small dot
 * ("chalk tip") tracks the end of the currently-writing line so it
 * reads as an act of writing, not a typewriter cursor.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: this is not freehand/stroke-based
 * handwriting (no bezier ink strokes per letter) — it's canvas-rendered
 * text with a progressive reveal. Real per-letter stroke rendering
 * (closer to lib's chalk-texture mentions from the sibling Nexus
 * AI-Guru project) is a separate, considerably larger effort — this
 * gets you a genuinely drawn, canvas-native board with a writing
 * animation, which is what was actually missing.
 *
 * IMPORTANT — Next.js/SSR: Konva needs a real browser canvas. This
 * file is safe to import directly (it's "use client" and touches no
 * DOM at module scope), but the PARENT that renders <WhiteboardCanvas>
 * must import it via next/dynamic with { ssr: false }, or Next's
 * server-side render pass for the page will crash trying to construct
 * a canvas that doesn't exist server-side. See rag-classroom/page.tsx
 * for the correct dynamic-import usage.
 */
import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Circle } from "react-konva";
import { safeStringify } from "@/lib/safe-storage";

interface Props {
  /** The scene's board bullets, e.g. lesson.scenes[i].board. */
  lines: string[];
  width?: number;
  height?: number;
  /** Writing speed in characters/second. */
  charsPerSecond?: number;
}

const BOARD_BG = "#16241d";   // matches Tailwind's `board` token
const CHALK = "#f4f1e8";      // matches Tailwind's `chalk` token
const CHALK_DIM = "#b9c4ba";  // matches Tailwind's `chalkdim` token
const LINE_HEIGHT = 30;
const PADDING = 16;
const FONT_SIZE = 16;
const FONT = `${FONT_SIZE}px Kalam, cursive`;

// Offscreen 2D context reused purely for text-width measurement, so the
// "chalk tip" cursor lands at the actual end of the revealed text
// instead of an estimated position — canvas text width isn't uniform
// per character, so this is the only reliable way to get it right.
let measureCanvas: HTMLCanvasElement | undefined;
function measureTextWidth(text: string): number {
  if (typeof document === "undefined") return 0;
  measureCanvas = measureCanvas || document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = FONT;
  return ctx.measureText(text).width;
}

export default function WhiteboardCanvas({ lines, width = 340, height, charsPerSecond = 26 }: Props) {
  const safeLines = lines?.length ? lines : [];
  const boardHeight = height ?? PADDING * 2 + Math.max(1, safeLines.length) * LINE_HEIGHT;

  // revealed[i] = how many characters of safeLines[i] have been "written" so far
  const [revealed, setRevealed] = useState<number[]>(() => safeLines.map(() => 0));
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // New scene (new `lines` array) — restart the writing animation from
    // scratch rather than trying to diff against the previous scene's text.
    setRevealed(safeLines.map(() => 0));
    setDone(false);
    let lineIndex = 0;
    let charIndex = 0;
    let last = performance.now();
    let acc = 0;
    const msPerChar = 1000 / Math.max(1, charsPerSecond);

    function tick(now: number) {
      const dt = now - last;
      last = now;
      acc += dt;
      let advanced = false;
      while (acc >= msPerChar && lineIndex < safeLines.length) {
        acc -= msPerChar;
        const line = safeLines[lineIndex] || "";
        if (charIndex < line.length) {
          charIndex++;
          advanced = true;
        } else {
          lineIndex++;
          charIndex = 0;
        }
      }
      if (advanced) {
        const li = lineIndex, ci = charIndex;
        setRevealed(prev => {
          const next = prev.slice();
          if (li < next.length) next[li] = ci;
          return next;
        });
      }
      if (lineIndex < safeLines.length) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    }

    if (safeLines.length) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setDone(true);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeStringify(safeLines), charsPerSecond]);

  // Where the "chalk tip" cursor should currently sit — end of the last
  // line that still has unrevealed characters, or hidden once done.
  let cursorX = PADDING, cursorY = PADDING;
  if (!done) {
    const activeLine = revealed.findIndex((r, i) => r < (safeLines[i]?.length || 0));
    const li = activeLine === -1 ? Math.max(0, safeLines.length - 1) : activeLine;
    const prefix = "• " + (safeLines[li]?.slice(0, revealed[li] || 0) || "");
    cursorX = PADDING + measureTextWidth(prefix);
    cursorY = PADDING + li * LINE_HEIGHT + FONT_SIZE / 2;
  }

  return (
    <Stage width={width} height={boardHeight}>
      <Layer listening={false}>
        <Rect x={0} y={0} width={width} height={boardHeight} fill={BOARD_BG} cornerRadius={12} />
        {safeLines.map((line, i) => (
          <Text
            key={i}
            x={PADDING}
            y={PADDING + i * LINE_HEIGHT}
            width={width - PADDING * 2}
            text={`• ${line.slice(0, revealed[i] || 0)}`}
            fontFamily="Kalam, cursive"
            fontSize={FONT_SIZE}
            fill={CHALK}
            wrap="word"
          />
        ))}
        {!done && safeLines.length > 0 && (
          <Circle x={cursorX + 3} y={cursorY} radius={3} fill={CHALK_DIM} opacity={0.9} />
        )}
      </Layer>
    </Stage>
  );
}
