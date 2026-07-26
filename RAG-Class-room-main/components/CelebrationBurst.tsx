"use client";
/**
 * A short confetti burst shown once, right when a setup step genuinely
 * completes (Gemini key saved, Local Brain downloaded) — a small,
 * satisfying moment of positive feedback for finishing something that
 * can otherwise feel like a fiddly technical chore. Pure Canvas, no new
 * dependency, matching how every other visual in this app is built.
 */
import { useEffect, useRef } from "react";

const COLORS = ["#e8a33d", "#7fb069", "#6fb0c4", "#c48a7a", "#f4f1e8"];

export function CelebrationBurst({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 120 }, () => ({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.5) * 16 - 4,
      size: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 20,
      life: 1,
    }));

    let raf: number;
    function tick() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.vy += 0.35; // gravity
        p.x += p.vx; p.y += p.vy; p.rotation += p.spin;
        p.life -= 0.012;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.globalAlpha = Math.max(p.life, 0);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx!.restore();
      }
      if (alive) { raf = requestAnimationFrame(tick); }
      else { onDone?.(); }
    }
    tick();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[60]" />;
}
