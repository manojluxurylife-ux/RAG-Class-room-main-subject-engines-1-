"use client";
/**
 * In-place Gemini key setup, launched directly from the Home page
 * checklist instead of navigating to the full Profile page. The
 * Profile page has a lot on it — settings, AI mode, materials
 * preferences — which is exactly the confusion this avoids: a student
 * clicking "set up my key" from Home shouldn't have to find it again
 * inside a bigger page.
 *
 * Wraps the existing GeminiKeySetup component (unchanged, still used
 * standalone on the Profile page too) rather than duplicating its
 * clipboard-detection/validation logic — this modal only adds voice
 * guidance and a celebration moment around it.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { GeminiKeySetup } from "./GeminiKeySetup";
import { VoiceGuide } from "./VoiceGuide";
import { CelebrationBurst } from "./CelebrationBurst";
import { getSetupVoiceScript } from "@/lib/setup-voice-scripts";
import { getSpeechLang } from "@/lib/web-speech";

export function GeminiKeySetupModal({ languageId, onClose, onDone }: {
  languageId: string; onClose: () => void; onDone: () => void;
}) {
  const [celebrating, setCelebrating] = useState(false);
  const script = getSetupVoiceScript(languageId);

  function handleSaved() {
    setCelebrating(true);
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(script.geminiKeyDone);
      u.lang = getSpeechLang(languageId);
      window.speechSynthesis.speak(u);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {celebrating && <CelebrationBurst onDone={() => { onDone(); onClose(); }} />}
      <div className="w-full max-w-md rounded-2xl border border-board3 bg-board p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <VoiceGuide lines={script.geminiKey} languageId={languageId} />
          <button onClick={onClose} className="p-1 text-chalkdim hover:text-terracotta transition-colors">
            <X size={16} />
          </button>
        </div>
        <GeminiKeySetup onKeySaved={handleSaved} />
      </div>
    </div>
  );
}
