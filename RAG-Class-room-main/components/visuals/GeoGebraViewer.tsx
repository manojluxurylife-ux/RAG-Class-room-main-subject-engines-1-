"use client";
/**
 * Renders a GeoGebraVisual as a real, interactive, draggable geometry
 * construction — not a static image. Loads GeoGebra's official
 * embeddable applet script once (free, mature, used across thousands of
 * educational sites for years) and evaluates the AI's commands against
 * it via GeoGebra's own scripting API.
 *
 * Safety note, consistent with every other visual type in this app: the
 * AI supplies commands in GeoGebra's own constrained input-bar language
 * (e.g. "A = (0, 0)", "Circle(A, 5)") — this is evaluated by GeoGebra's
 * applet, not executed as arbitrary JS. Malformed commands are caught
 * per-command (ggbApplet.evalCommand returns false on failure) rather
 * than one bad line breaking the whole construction.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { GeoGebraVisual } from "@/lib/visual-schema";

declare global {
  interface Window {
    ggbApplet?: any;
    GGBApplet?: new (params: Record<string, unknown>, version: string) => { inject: (id: string) => void };
  }
}

const GGB_SCRIPT_URL = "https://www.geogebra.org/apps/deployggb.js";
let scriptLoadPromise: Promise<void> | null = null;

function loadGeoGebraScript(): Promise<void> {
  if (typeof window !== "undefined" && window.GGBApplet) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GGB_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load GeoGebra."));
    document.body.appendChild(script);
  });
  return scriptLoadPromise;
}

export function GeoGebraViewer({ visual }: { visual: GeoGebraVisual }) {
  const containerId = `ggb-${useId().replace(/:/g, "")}`;
  const appletRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== "undefined" && !navigator.onLine && !window.GGBApplet) {
      setStatus("error");
      return () => { cancelled = true; };
    }

    loadGeoGebraScript()
      .then(() => {
        if (cancelled || !window.GGBApplet) return;
        const applet = new window.GGBApplet(
          {
            appName: "classic", width: 480, height: 320,
            showToolBar: false, showAlgebraInput: false, showMenuBar: false,
            enableRightClick: false, enableShiftDragZoom: true,
            appletOnLoad: (api: any) => {
              if (cancelled) return;
              appletRef.current = api;
              // Evaluate each command independently — a malformed line
              // from the AI is skipped, not fatal to the rest of the figure.
              for (const cmd of visual.commands) {
                try { api.evalCommand(cmd); } catch { /* skip this one command */ }
              }
              setStatus("ready");
            },
          },
          "8.0",
        );
        applet.inject(containerId);
      })
      .catch(() => { if (!cancelled) setStatus("error"); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") {
    return <div className="rounded-lg border border-board3 bg-board p-4 text-xs text-chalkdim"><b className="text-chalk">Offline geometry instructions</b><p className="mt-1">The GeoGebra web applet needs internet the first time. The saved construction is still available:</p><ol className="mt-2 list-decimal space-y-1 pl-5">{visual.commands.map((cmd, i) => <li key={i} className="font-mono">{cmd}</li>)}</ol>{visual.caption && <p className="mt-2">{visual.caption}</p>}</div>;
  }

  return (
    <div className="rounded-lg border border-board3 bg-board overflow-hidden">
      {status === "loading" && <div className="h-[320px] animate-pulse bg-board2" />}
      <div id={containerId} className={status === "loading" ? "hidden" : ""} />
      {visual.caption && status === "ready" && (
        <div className="border-t border-board3 px-3 py-2 text-xs text-chalkdim">{visual.caption}</div>
      )}
      {status === "ready" && (
        <div className="border-t border-board3 px-3 py-1.5 text-center font-mono text-[9px] text-chalkdim">
          Drag the points — this figure is interactive
        </div>
      )}
    </div>
  );
}
