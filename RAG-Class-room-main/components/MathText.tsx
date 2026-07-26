"use client";
/**
 * Renders text containing inline ($...$) or block ($$...$$) LaTeX math
 * via KaTeX, leaving everything else as plain text. Deliberately scoped
 * to Creator Studio's markdown-based generators only (revision notes,
 * quiz, formula sheets) — NOT the live classroom lesson. Reason: lesson
 * text is the kind of content that could reasonably be read aloud by
 * the browser's Web Speech API (lib/web-speech.ts, the app's only TTS
 * mechanism) — raw LaTeX handed to a speech synthesizer would make it
 * try to pronounce the syntax literally. A forward-looking constraint,
 * not a currently-wired integration — the classroom lesson isn't
 * actually connected to any TTS right now. See lib/content-generators.ts
 * for where math notation is actually requested from the AI.
 *
 * KaTeX (adopted from evaluating dpaul0501/OpenVidya's dependency list)
 * is lightweight, client-side, MIT-licensed, and has no heavy transitive
 * dependencies — a real, low-risk upgrade over the "plain words only"
 * math we had before in this one specific, non-narrated context.
 */
import { useEffect, useRef } from "react";
import "katex/dist/katex.min.css";

interface Segment {
  type: "text" | "inline-math" | "block-math";
  content: string;
}

function splitMath(text: string): Segment[] {
  const segments: Segment[] = [];
  // Block math ($$...$$) first, so its inner $ signs aren't mistaken for inline math
  const blockSplit = text.split(/(\$\$[^$]+\$\$)/g);
  for (const chunk of blockSplit) {
    if (chunk.startsWith("$$") && chunk.endsWith("$$")) {
      segments.push({ type: "block-math", content: chunk.slice(2, -2) });
      continue;
    }
    const inlineSplit = chunk.split(/(\$[^$\n]+\$)/g);
    for (const piece of inlineSplit) {
      if (piece.startsWith("$") && piece.endsWith("$") && piece.length > 1) {
        segments.push({ type: "inline-math", content: piece.slice(1, -1) });
      } else if (piece) {
        segments.push({ type: "text", content: piece });
      }
    }
  }
  return segments;
}

function KatexSpan({ tex, block }: { tex: string; block: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const katex = (await import("katex")).default;
        if (cancelled || !ref.current) return;
        katex.render(tex, ref.current, {
          throwOnError: false,   // malformed AI-generated LaTeX degrades to a visible error string, not a crash
          displayMode: block,
        });
      } catch {
        if (ref.current) ref.current.textContent = tex; // fall back to raw text if KaTeX itself fails to load
      }
    })();
    return () => { cancelled = true; };
  }, [tex, block]);

  return <span ref={ref} className={block ? "block my-2" : "mx-0.5"} />;
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = splitMath(text);
  // No math present — skip KaTeX entirely, zero overhead for the common case
  if (segments.every(s => s.type === "text")) {
    return <span className={className}>{text}</span>;
  }
  return (
    <span className={className}>
      {segments.map((s, i) =>
        s.type === "text"
          ? <span key={i}>{s.content}</span>
          : <KatexSpan key={i} tex={s.content} block={s.type === "block-math"} />,
      )}
    </span>
  );
}
