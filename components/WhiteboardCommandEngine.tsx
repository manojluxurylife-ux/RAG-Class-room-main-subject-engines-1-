"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Line, Circle, Arrow, Ellipse } from "react-konva";
import { normalizeWhiteboardPlan } from "@/lib/whiteboard-commands";
import { layoutWhiteboardText, type TextMetricsProvider } from "@/lib/whiteboard-layout";
import { Pause, Play, RotateCcw, Gauge } from "lucide-react";

interface Props {
  plan?: unknown;
  fallbackLines?: string[];
  width?: number;
  height?: number;
  playing?: boolean;
  syncToken?: number;
  onComplete?: () => void;
  /** Fired once, right when a "write" command with its own `narration`
   *  field (see lib/whiteboard-commands.ts) starts being written — the
   *  caller is expected to speak it (fire-and-forget; this component
   *  keeps pacing itself off each command's own durationMs regardless
   *  of how long that speech actually takes). This is what makes the
   *  board "explain while writing" instead of writing silently. */
  onNarrateLine?: (text: string) => void;
}

type BoardItem = {
  id: string; text: string; displayLines: string[]; x: number; y: number; width: number; height: number;
  color: string; fontSize: number; lineHeight: number; reveal: number; page: number; erased?: boolean;
};
type Mark = { id: string; kind: "underline" | "circle" | "arrow"; target?: string; from?: string; to?: string; color: string; progress: number; page: number };

const BG = "#14251d";
const CHALK = "#f4f1e8";
const ACCENT = "#f4b942";
const LASER = "#ff4d4d";
const PAD = 18;
const GAP = 10;
// Board content is no longer clipped/paginated to the visible viewport
// height — see the "write" command handling below — so text layout
// gets a generous ceiling instead of the actual (fixed) viewport
// height. Nothing realistic in a single paragraph's worth of solve
// steps comes close to this; it just means "don't artificially cap
// how tall a piece of writing can be."
const GROWABLE_LAYOUT_CEILING = 20000;

let measureCanvas: HTMLCanvasElement | undefined;
const browserMetrics: TextMetricsProvider = {
  measure(text, fontSize, fontFamily) {
    if (typeof document === "undefined") return text.length * fontSize * 0.55;
    measureCanvas ||= document.createElement("canvas");
    const context = measureCanvas.getContext("2d");
    if (!context) return text.length * fontSize * 0.55;
    context.font = `${fontSize}px ${fontFamily}`;
    return context.measureText(text).width;
  },
};

function itemBounds(item: BoardItem) {
  return { x: item.x, y: item.y, width: item.width, height: item.height };
}

function graphemeArray(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), part => part.segment);
  }
  return Array.from(text);
}

export default function WhiteboardCommandEngine({ plan, fallbackLines = [], width = 560, height = 330, playing = true, syncToken = 0, onComplete, onNarrateLine }: Props) {
  const fallbackKey = JSON.stringify(fallbackLines);
  const normalized = useMemo(() => normalizeWhiteboardPlan(plan, fallbackLines), [plan, fallbackKey]);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [laserTarget, setLaserTarget] = useState<string | null>(null);
  const [running, setRunning] = useState(playing && normalized.autoplay !== false);
  const [speed, setSpeed] = useState(1);
  const [commandIndex, setCommandIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const cancelled = useRef(false);
  const completed = useRef(false);
  const itemsRef = useRef<BoardItem[]>([]);
  const marksRef = useRef<Mark[]>([]);
  const pageRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const updateItems = useCallback((updater: (prev: BoardItem[]) => BoardItem[]) => {
    setItems(prev => {
      const next = updater(prev);
      itemsRef.current = next;
      return next;
    });
  }, []);
  const updateMarks = useCallback((updater: (prev: Mark[]) => Mark[]) => {
    setMarks(prev => {
      const next = updater(prev);
      marksRef.current = next;
      return next;
    });
  }, []);

  const setPage = useCallback((page: number) => {
    pageRef.current = page;
    setCurrentPage(page);
  }, []);

  const reset = useCallback(() => {
    cancelled.current = true;
    completed.current = false;
    itemsRef.current = [];
    marksRef.current = [];
    pageRef.current = 0;
    setItems([]); setMarks([]); setLaserTarget(null); setCommandIndex(0); setCurrentPage(0);
    requestAnimationFrame(() => { cancelled.current = false; setRunning(playing && normalized.autoplay !== false); });
  }, [normalized, playing]);

  useEffect(() => reset(), [normalized, syncToken, reset]);
  useEffect(() => setRunning(playing), [playing]);

  useEffect(() => {
    if (commandIndex >= normalized.commands.length && normalized.commands.length) {
      if (!completed.current) { completed.current = true; onComplete?.(); }
      return;
    }
    if (!running) return;

    cancelled.current = false;
    const command = normalized.commands[commandIndex];
    const duration = Math.max(80, Number(command.durationMs ?? (command.action === "write" ? command.text.length * 55 : 650)) / speed);
    const start = performance.now();
    const id = command.id || `${command.action}-${commandIndex}`;

    if (command.action === "write" && command.narration) onNarrateLine?.(command.narration);

    if (command.action === "write") {
      const explicitX = command.x === undefined ? undefined : Math.max(PAD, Math.min(width - PAD - 1, Number(command.x)));
      const page = pageRef.current;
      const visible = itemsRef.current.filter(item => !item.erased && item.page === page);
      let y = command.y === undefined ? (visible.length ? Math.max(...visible.map(item => item.y + item.height)) + GAP : PAD) : Math.max(PAD, Number(command.y));
      const x = explicitX ?? PAD;
      const availableWidth = Math.max(40, width - x - PAD);
      // Was capped to (height - y - PAD) — the fixed viewport height —
      // which is what forced a silent, hidden "new page" (see the
      // block this replaced) the moment a paragraph's solve steps
      // added up to more than one screenful. Now the board just keeps
      // growing downward and the scrollable wrapper below follows it,
      // like writing further down a real chalkboard instead of wiping
      // it clean and starting over out of student's the sight.
      const layout = layoutWhiteboardText(command.text, availableWidth, Number(command.fontSize || 22), browserMetrics, GROWABLE_LAYOUT_CEILING);
      const itemHeight = layout.height;
      updateItems(prev => [...prev, {
        id, text: command.text, displayLines: layout.lines, x, y,
        width: layout.width, height: itemHeight, color: command.color || CHALK,
        fontSize: layout.fontSize, lineHeight: layout.lineHeight, reveal: 0, page,
      }]);
    } else if (command.action === "underline" || command.action === "circle") {
      const target = itemsRef.current.find(item => item.id === command.target && !item.erased);
      if (target) {
        if (target.page !== pageRef.current) setPage(target.page);
        updateMarks(prev => [...prev, { id, kind: command.action as "underline" | "circle", target: command.target, color: command.color || ACCENT, progress: 0, page: target.page }]);
      }
    } else if (command.action === "arrow") {
      const from = itemsRef.current.find(item => item.id === command.from && !item.erased);
      const to = itemsRef.current.find(item => item.id === command.to && !item.erased);
      if (from && to && from.page === to.page) {
        if (from.page !== pageRef.current) setPage(from.page);
        updateMarks(prev => [...prev, { id, kind: "arrow", from: command.from, to: command.to, color: command.color || ACCENT, progress: 0, page: from.page }]);
      }
    } else if (command.action === "laser") {
      const target = itemsRef.current.find(item => item.id === command.target && !item.erased);
      if (target) { if (target.page !== pageRef.current) setPage(target.page); setLaserTarget(command.target); }
    } else if (command.action === "erase") {
      updateItems(prev => prev.map(item => item.id === command.target ? { ...item, erased: true } : item));
      updateMarks(prev => prev.filter(mark => mark.target !== command.target && mark.from !== command.target && mark.to !== command.target));
      if (laserTarget === command.target) setLaserTarget(null);
    } else if (command.action === "clear") {
      // Keep history for replay/debugging but move to a new empty page.
      setLaserTarget(null);
      setPage(pageRef.current + 1);
    }

    let raf = 0;
    const tick = (now: number) => {
      if (cancelled.current) return;
      const progress = Math.min(1, (now - start) / duration);
      if (command.action === "write") updateItems(prev => prev.map(item => item.id === id ? { ...item, reveal: progress } : item));
      if (command.action === "underline" || command.action === "circle" || command.action === "arrow") {
        updateMarks(prev => prev.map(mark => mark.id === id ? { ...mark, progress } : mark));
      }
      if (progress < 1) raf = requestAnimationFrame(tick);
      else {
        if (command.action === "laser") setLaserTarget(null);
        setCommandIndex(index => index + 1);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, commandIndex, normalized, speed, width, height, laserTarget, onComplete, onNarrateLine, setPage, updateItems, updateMarks]);

  const itemMap = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const laserItem = laserTarget ? itemMap.get(laserTarget) : undefined;
  const pageItems = items.filter(item => !item.erased && item.page === currentPage);
  const pageMarks = marks.filter(mark => mark.page === currentPage);
  // The viewport (the wrapping div below) stays at the fixed `height`
  // prop — that's what makes it scrollable rather than ever-expanding
  // in the page layout — but the Konva Stage inside it grows to fit
  // however much has actually been written, so nothing gets clipped.
  const stageHeight = Math.max(height, ...pageItems.map(item => item.y + item.height), 0) + PAD;

  // Follows the newest line down the board as it's written, the same
  // way a teacher's hand (and a student's eyes) would track down a
  // real chalkboard once it fills past one screenful — keyed on
  // commandIndex (once per completed step) rather than every reveal-
  // animation frame, so it doesn't fight a smooth-scroll with itself
  // dozens of times a second while a single line is still typing out.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [commandIndex, currentPage]);

  return <div className="w-full" data-testid="whiteboard-engine" data-page={currentPage} data-command-index={commandIndex}>
    <div ref={scrollContainerRef} style={{ height, overflowY: "auto" }} className="rounded-[14px]">
      <Stage width={width} height={stageHeight}>
        <Layer clipX={0} clipY={0} clipWidth={width} clipHeight={stageHeight}>
          <Rect x={0} y={0} width={width} height={stageHeight} fill={BG} cornerRadius={14}/>
          {pageItems.map(item => {
          const full = item.displayLines.join("\n");
          const chars = graphemeArray(full);
          const visibleText = chars.slice(0, Math.ceil(chars.length * item.reveal)).join("");
          return <Text key={item.id} x={item.x} y={item.y} width={width - item.x - PAD} height={item.height}
            text={visibleText} fontFamily="Kalam, cursive" fontSize={item.fontSize} fill={item.color}
            lineHeight={item.lineHeight / item.fontSize} wrap="none" data-testid={`board-item-${item.id}`}/>;
        })}
        {pageMarks.map(mark => {
          if (mark.kind === "arrow") {
            const a = mark.from ? itemMap.get(mark.from) : undefined, b = mark.to ? itemMap.get(mark.to) : undefined;
            if (!a || !b || a.erased || b.erased || a.page !== currentPage || b.page !== currentPage) return null;
            const ab = itemBounds(a), bb = itemBounds(b);
            const x1 = ab.x + ab.width, y1 = ab.y + ab.height / 2, x2 = bb.x + bb.width, y2 = bb.y + bb.height / 2;
            return <Arrow key={mark.id} points={[x1, y1, x1 + (x2 - x1) * mark.progress, y1 + (y2 - y1) * mark.progress]} stroke={mark.color} fill={mark.color} pointerLength={8} pointerWidth={8} strokeWidth={3}/>;
          }
          const target = mark.target ? itemMap.get(mark.target) : undefined;
          if (!target || target.erased || target.page !== currentPage) return null;
          const bounds = itemBounds(target);
          if (mark.kind === "underline") return <Line key={mark.id} points={[bounds.x, bounds.y + bounds.height, bounds.x + bounds.width * mark.progress, bounds.y + bounds.height]} stroke={mark.color} strokeWidth={3} lineCap="round" tension={0.25}/>;
          return <Ellipse key={mark.id} x={bounds.x + bounds.width / 2} y={bounds.y + bounds.height / 2} radiusX={(bounds.width / 2 + 8) * mark.progress} radiusY={(bounds.height / 2 + 6) * mark.progress} stroke={mark.color} strokeWidth={3} dash={[8, 4]}/>;
        })}
        {laserItem && !laserItem.erased && laserItem.page === currentPage && (() => { const bounds = itemBounds(laserItem); return <><Circle x={bounds.x + bounds.width + 7} y={bounds.y + bounds.height / 2} radius={6} fill={LASER} shadowColor={LASER} shadowBlur={18}/><Line points={[bounds.x + bounds.width + 7, bounds.y + bounds.height / 2, bounds.x + bounds.width + 45, bounds.y + bounds.height / 2 - 20]} stroke={LASER} strokeWidth={2} opacity={0.75}/></>; })()}
      </Layer>
    </Stage>
    </div>
    <div className="mt-2 flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-chalkdim">
      <span>Board step {Math.min(commandIndex + 1, normalized.commands.length)}/{normalized.commands.length}{currentPage > 0 ? ` · page ${currentPage + 1}` : ""}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setSpeed(value => value >= 2 ? .75 : value + .25)} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10" title="Writing speed"><Gauge size={14}/>{speed}×</button>
        <button type="button" onClick={() => setRunning(value => !value)} className="rounded p-1 hover:bg-white/10" aria-label={running ? "Pause whiteboard" : "Play whiteboard"}>{running ? <Pause size={16}/> : <Play size={16}/>}</button>
        <button type="button" onClick={reset} className="rounded p-1 hover:bg-white/10" aria-label="Replay whiteboard"><RotateCcw size={16}/></button>
      </div>
    </div>
  </div>;
}
