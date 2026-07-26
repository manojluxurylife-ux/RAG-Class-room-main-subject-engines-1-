"use client";
/**
 * Setup checklist shown on the student dashboard, above "Start today's
 * lesson" — three one-time setup steps that make the app work better,
 * not steps required to use it at all.
 *
 * DELIBERATE DESIGN CHOICE: none of these three items block "Start
 * today's lesson". The classroom already works out of the box via the
 * server's own Gemini key (lib/teacher-prompts.ts) — that's the whole
 * point of the free-entry, graceful-fallback approach used throughout
 * this app (see lib/dev-mode.ts, the BYOK/offline fallback in
 * app/(student)/classroom/page.tsx). Hard-blocking lessons behind setup
 * would contradict that and make the first-time experience worse, not
 * better. So this checklist nudges — it doesn't gate.
 *
 * Gemini key and Local Brain now open an IN-PLACE modal instead of
 * navigating to the full Profile page — a student clicking "set up my
 * key" from Home shouldn't have to go find it again inside a bigger
 * page with a lot of unrelated settings on it. Each modal narrates its
 * steps aloud in the student's own mother tongue (from their signup
 * language choice), and a completed step turns a distinct green — not
 * the app's usual marigold — specifically so "this is now active"
 * reads as a clearly different state, not just another highlighted card.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Key, HardDrive, BookOpen, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui";
import { studentKey, validateGeminiKey } from "@/lib/student-key";
import { offlineAI, type OfflineStatus } from "@/lib/offline-ai";
import { studentSession } from "@/lib/student-session";
import { GeminiKeySetupModal } from "./GeminiKeySetupModal";
import { LocalBrainSetupModal } from "./LocalBrainSetupModal";

export function SetupChecklist() {
  const profile = studentSession.get();
  const [hasKey, setHasKey] = useState(false);
  const [keyConnection, setKeyConnection] = useState<"checking"|"connected"|"disconnected">("checking");
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>("not-downloaded");
  const [dismissed, setDismissed] = useState(false);
  const [openModal, setOpenModal] = useState<"gemini" | "local-brain" | null>(null);

  useEffect(() => {
    const checkKey = () => {
      const savedKey = studentKey.getSaved();
      setHasKey(!!savedKey);
      if (savedKey) {
        if (studentKey.isKeyValidated(savedKey)) {
          setKeyConnection("connected");
        } else {
          setKeyConnection("disconnected");
        }
      } else {
        setKeyConnection("disconnected");
      }
    };
    
    checkKey();
    window.addEventListener("gemini-key-pool-changed", checkKey);
    setOfflineStatus(offlineAI.getStatus());
    setDismissed(localStorage.getItem("gg_setup_dismissed") === "1");
    
    return () => window.removeEventListener("gemini-key-pool-changed", checkKey);
  }, []);

  const keyDone      = hasKey && keyConnection === "connected";
  const offlineDone  = offlineStatus === "ready";
  const allDone      = keyDone && offlineDone; // "Download Syllabus" has no persistent "done" state — it's a reference, not a one-time setup

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem("gg_setup_dismissed", "1");
    setDismissed(true);
  }

  const languageId = profile?.languageId || "english";

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-display text-base text-chalk">Get set up</div>
        {allDone && (
          <button onClick={dismiss} className="font-mono text-[10px] text-chalkdim hover:text-chalk">
            Hide this ✕
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">

        {/* 1. Gemini BYOK key — opens in place, not a navigation */}
        <button onClick={() => setOpenModal("gemini")} className="text-left">
          <Card className={`h-full py-3.5 transition-colors ${keyDone ? "border-green-500/50 bg-green-500/5" : "hover:border-marigold/60"}`}>
            <div className="flex items-start gap-2.5">
              {keyDone ? <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" /> : <Key size={16} className="text-chalkdim shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <div className="text-sm text-chalk font-medium">Gemini API key</div>
                <div className="mt-0.5 text-xs text-chalkdim leading-snug">
                  {keyConnection === "checking" ? "Checking connection…" : keyDone ? "Connected and active" : hasKey ? "Saved key is not connected — open to fix" : "Free, no card needed — 2 min setup"}
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-1 font-mono text-[10px] text-marigold">
              {keyDone ? "Open or replace key" : "Set up or reconnect key"} <ArrowRight size={10} />
            </div>
          </Card>
        </button>

        {/* 2. Download Local Brain (offline Qwen3.5 0.8B) — opens in place too */}
        <button onClick={() => offlineStatus !== "downloading" && setOpenModal("local-brain")}
          disabled={offlineStatus === "downloading"} className="text-left disabled:cursor-wait">
          <Card className={`h-full py-3.5 transition-colors ${offlineDone ? "border-green-500/50 bg-green-500/5" : "hover:border-marigold/60"}`}>
            <div className="flex items-start gap-2.5">
              {offlineDone
                ? <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                : offlineStatus === "downloading"
                ? <Loader2 size={16} className="text-marigold shrink-0 mt-0.5 animate-spin" />
                : <HardDrive size={16} className="text-chalkdim shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <div className="text-sm text-chalk font-medium">Local Brain · Qwen3.5 0.8B</div>
                <div className="mt-0.5 text-xs text-chalkdim leading-snug">
                  {offlineDone
                    ? "Ready — works with no internet"
                    : offlineStatus === "downloading"
                    ? "Downloading…"
                    : "Backup AI for when you're offline"}
                </div>
              </div>
            </div>
            {offlineStatus !== "downloading" && (
              <div className="mt-2.5 flex items-center gap-1 font-mono text-[10px] text-marigold">
                {offlineDone ? "Open Local Brain" : "Download Qwen3.5"} <ArrowRight size={10} />
              </div>
            )}
          </Card>
        </button>

        {/* 3. Download Syllabus — a reference page, genuinely a navigation, not a modal-sized task */}
        <Link href="/materials/textbooks">
          <Card className="h-full py-3.5 hover:border-marigold/60 transition-colors">
            <div className="flex items-start gap-2.5">
              <BookOpen size={16} className="text-chalkdim shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm text-chalk font-medium">Download Syllabus</div>
                <div className="mt-0.5 text-xs text-chalkdim leading-snug">
                  CBSE, Kerala, Tamil Nadu, Karnataka textbooks
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-1 font-mono text-[10px] text-marigold">
              Browse official textbooks <ArrowRight size={10} />
            </div>
          </Card>
        </Link>

      </div>

      {openModal === "gemini" && (
        <GeminiKeySetupModal
          languageId={languageId}
          onClose={() => setOpenModal(null)}
          onDone={() => { setHasKey(true); setKeyConnection("connected"); }}
        />
      )}
      {openModal === "local-brain" && (
        <LocalBrainSetupModal
          languageId={languageId}
          onClose={() => setOpenModal(null)}
          onDone={() => setOfflineStatus("ready")}
        />
      )}
    </div>
  );
}
