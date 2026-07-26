"use client";
/**
 * Speaks a sequence of pre-translated lines aloud, one after another,
 * in the student's own language — Web Speech synthesis, the same
 * mechanism already used elsewhere in this app (see lib/web-speech.ts).
 * A visible "Replay" control since autoplay can be blocked by the
 * browser until the student has interacted with the page at least once.
 */
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { getSpeechLang } from "@/lib/web-speech";

export function VoiceGuide({ lines, languageId, autoPlay = true }: {
  lines: string[]; languageId: string; autoPlay?: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);
  const cancelledRef = useRef(false);

  function play() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    cancelledRef.current = false;
    setSpeaking(true);

    let i = 0;
    function speakNext() {
      if (cancelledRef.current || i >= lines.length) { setSpeaking(false); return; }
      const utterance = new SpeechSynthesisUtterance(lines[i]);
      utterance.lang = getSpeechLang(languageId);
      utterance.rate = 0.95;
      utterance.onend = () => { i++; speakNext(); };
      utterance.onerror = () => { i++; speakNext(); }; // one bad line shouldn't silence the rest
      window.speechSynthesis.speak(utterance);
    }
    speakNext();
  }

  function stop() {
    cancelledRef.current = true;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  useEffect(() => {
    if (autoPlay) play();
    return () => { cancelledRef.current = true; window.speechSynthesis?.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button onClick={speaking ? stop : play}
      className="inline-flex items-center gap-1.5 rounded-full border border-marigold/40 bg-marigold/10 px-3 py-1.5 font-mono text-[10px] text-marigold hover:bg-marigold/20 transition-colors">
      {speaking ? <><VolumeX size={12} /> Stop</> : <><Volume2 size={12} /> Hear this again</>}
    </button>
  );
}
