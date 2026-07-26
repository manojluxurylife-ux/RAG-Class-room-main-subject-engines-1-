"use client";
/**
 * In-place Local Brain (offline Qwen3.5 0.8B) download, launched
 * directly from the Home page checklist — same reasoning as
 * GeminiKeySetupModal: avoid sending a student into the full Profile
 * page just to find one button.
 *
 * Self-contained rather than extracted from the Profile page's existing
 * download UI, to avoid touching or risking that already-working flow —
 * this is its own independent user of lib/offline-ai.ts's download().
 */
import { useEffect, useState } from "react";
import { X, Download, Loader2, HardDrive } from "lucide-react";
import { offlineAI } from "@/lib/offline-ai";
import { VoiceGuide } from "./VoiceGuide";
import { CelebrationBurst } from "./CelebrationBurst";
import { getSetupVoiceScript } from "@/lib/setup-voice-scripts";
import { getSpeechLang } from "@/lib/web-speech";

export function LocalBrainSetupModal({ languageId, onClose, onDone }: {
  languageId: string; onClose: () => void; onDone: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const [initializingSeconds, setInitializingSeconds] = useState(0);
  const script = getSetupVoiceScript(languageId);

  // 100% means all model bytes are cached. wllama then verifies the GGUF,
  // starts its WASM backend and allocates the context before it is usable.
  // Show that second phase explicitly so 100% never looks like a stuck file.
  useEffect(() => {
    if (!downloading || progress < 100) { setInitializingSeconds(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setInitializingSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [downloading, progress]);

  async function download() {
    setDownloading(true); setError("");
    try {
      await offlineAI.download((pct: number) => setProgress(pct));
      setCelebrating(true);
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(script.localBrainDone);
        u.lang = getSpeechLang(languageId);
        window.speechSynthesis.speak(u);
      }
    } catch (e: any) {
      setError(e.message || "Download failed. Check your connection and try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {celebrating && <CelebrationBurst onDone={() => { onDone(); onClose(); }} />}
      <div className="w-full max-w-md rounded-2xl border border-board3 bg-board p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-marigold" />
            <div className="font-display text-base text-chalk">Local Brain · Qwen3.5 0.8B</div>
          </div>
          <button onClick={onClose} className="p-1 text-chalkdim hover:text-terracotta transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="mb-3">
          <VoiceGuide lines={script.localBrain} languageId={languageId} />
        </div>

        <p className="mb-4 text-sm text-chalkdim leading-relaxed">
          A backup teacher that lives on this device and works with no internet at all —
          about 550 MB. Wi-Fi is still the safer choice on a limited data plan, but this is a much lighter download than earlier versions of this feature.
        </p>

        <div className="mb-4 rounded-xl border border-sky-400/20 bg-sky-500/10 p-3 text-xs leading-5 text-sky-100">
          Accelerated download is enabled with up to 6 parallel transfers. Keep this page open; completed cached data is reused if you retry.
        </div>

        {downloading && (
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-chalkdim">
              <span>{progress >= 100 ? "Download complete — starting Local Brain…" : "Downloading…"}</span><span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-board3">
              <div className="h-full bg-marigold transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            {progress >= 100 && (
              <div className="mt-2 text-xs leading-5 text-green-300">
                The Qwen3.5 model is downloaded. Preparing it for offline use{initializingSeconds ? ` · ${initializingSeconds}s` : ""}. Keep this tab open; this one-time step can take a few minutes.
              </div>
            )}
          </div>
        )}
        {error && <div className="mb-4 text-sm text-terracotta">{error}</div>}

        <button onClick={download} disabled={downloading}
          className="inline-flex items-center gap-2 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-board hover:bg-marigolddim disabled:opacity-50 transition-colors">
          {downloading ? <><Loader2 size={14} className="animate-spin" /> {progress >= 100 ? "Starting Local Brain…" : "Downloading…"}</> : <><Download size={14} /> Download Qwen3.5</>}
        </button>
      </div>
    </div>
  );
}
