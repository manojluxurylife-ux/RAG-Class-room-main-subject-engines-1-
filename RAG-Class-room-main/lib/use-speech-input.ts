"use client";
/**
 * useSpeechInput — small reusable speech-to-text hook for mic buttons.
 *
 * Uses the browser's built-in SpeechRecognition (webkitSpeechRecognition
 * on Android Chrome — the app's primary target device) — free, no API
 * key, matching the app's standing decision to use Web Speech for voice
 * (see lib/web-speech.ts: the Sarvam AI integration was removed and the
 * app standardizes on browser speech + the student's own Gemini key).
 *
 * The recognition language comes from getSpeechLang(languageId), the
 * SAME mapping already used for spoken narration (VoiceGuide,
 * DoubtCameraMic) — so a student who set Malayalam at signup dictates
 * in Malayalam here too, with no separate setting.
 *
 * Honest limitation, not hidden: SpeechRecognition on Chrome/Android
 * sends audio to Google's speech service, so dictation needs internet
 * even though it needs no key. Fully-offline voice input is not
 * possible with Web Speech; offline students can still type.
 *
 * One utterance per tap (continuous = false): the student taps the mic,
 * speaks one question, and recognition stops itself — simpler and less
 * error-prone on budget Android devices than an always-open stream,
 * and it never holds the mic while the global Gemini Live dock might
 * want it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechLang } from "@/lib/web-speech";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechInput(
  languageId: string,
  onFinalText: (text: string) => void,
) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Keep the latest callback without re-creating the recognizer.
  const onTextRef = useRef(onFinalText);
  onTextRef.current = onFinalText;

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    return () => {
      // Never leave the mic held when the page unmounts.
      try { recRef.current?.abort(); } catch { /* already stopped */ }
    };
  }, []);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) { setSupported(false); return; }
    // A fresh instance per utterance — reusing one instance across
    // start/stop cycles is flaky on Android Chrome (silent no-ops).
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = getSpeechLang(languageId);
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results as ArrayLike<any>)
        .map(r => r[0]?.transcript || "")
        .join(" ")
        .trim();
      if (text) onTextRef.current(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [languageId]);

  const toggle = useCallback(() => {
    if (listening) stop(); else start();
  }, [listening, start, stop]);

  return { listening, supported, toggle };
}
