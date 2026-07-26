"use client";
import { useEffect, useRef, useState } from "react";

// Reveals text one character at a time with natural jitter and a longer
// pause after punctuation. `speed` is read from a ref so it can change
// mid-line (e.g. user adjusts the speed control) without restarting.
export function Typewriter({
  text,
  speed = 16,
  onDone,
  onStart,
}: {
  text: string;
  speed?: number;
  onDone?: () => void;
  onStart?: (t: string) => void;
}) {
  const [count, setCount] = useState(0);
  const safeText = text || "";
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    setCount(0);
    if (!safeText) {
      onDone?.();
      return;
    }
    onStart?.(safeText);
    let cancelled = false;
    let i = 0;
    function tick() {
      if (cancelled) return;
      const s = speedRef.current;
      if (s <= 0) {
        setCount(safeText.length);
        onDone?.();
        return;
      }
      i += 1;
      setCount(i);
      if (i >= safeText.length) {
        onDone?.();
        return;
      }
      const ch = safeText[i - 1];
      let delay = s + Math.random() * Math.max(4, s * 0.8);
      if (".,!?".includes(ch)) delay += s * 8;
      setTimeout(tick, delay);
    }
    const start = setTimeout(tick, Math.max(20, speedRef.current * 2));
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeText]);

  const shown = safeText.slice(0, count);
  const done = count >= safeText.length;
  return (
    <span>
      {shown}
      <span className="ml-px text-marigold" style={{ opacity: done ? 0 : 1 }}>
        ▍
      </span>
    </span>
  );
}

export const SPEED_LEVELS = [
  { id: "very-slow", label: "Very Slow", ms: 95 },
  { id: "slow", label: "Slow", ms: 42 },
  { id: "normal", label: "Normal", ms: 16 },
  { id: "fast", label: "Fast", ms: 5 },
  { id: "instant", label: "Instant", ms: 0 },
];
