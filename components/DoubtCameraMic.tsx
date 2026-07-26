"use client";
/**
 * DoubtCameraMic — "Show AI Guru" live camera + mic + text
 * doubt-clearing panel.
 *
 * UI: copied VERBATIM from the working Nexus Justice floating
 * "Secure Voice Channel" console + pill hardware dock
 * (Agent--Firebase-main / App.tsx, "GLOBAL HARDWARE DOCK" section).
 * Same classes, same colors (#050915 navy, indigo, amber), same shadows,
 * same glowing spots, same inline SVG camera/mic icons, same
 * "NEXUS LINK / ACTIVE" status block. Nothing restyled.
 * The only text changed: "Legal Counsel response" → "Ai-Guru response"
 * (domain correctness for a maths app — styling identical).
 *
 * The pane now floats via .hardware-dock-center (globals.css) and the
 * pill dock is ALWAYS visible — exactly like the reference app — so it
 * appears on every page it is mounted under (see GlobalDoubtDock in the
 * student layout). The console card appears above the dock only while
 * mic/camera hardware is live, exactly as in the reference.
 *
 * Two features this app has that the reference console doesn't were
 * KEPT (removing working features was not asked): the typed-text input
 * (sendClientContent — same live conversation as voice) and the offline
 * on-device vision fallback. Both are styled in the reference's exact
 * palette so the pane reads as one design. A compact camera preview was
 * also kept inside the console — in this app the student must aim the
 * camera at their textbook, and unlike Nexus Justice there is no large
 * workspace camera panel elsewhere to rely on.
 *
 * Streaming logic (lib/gemini-live.ts) is UNTOUCHED from the previously
 * verified working version: 16kHz PCM audio in, 24kHz PCM audio out,
 * 2fps JPEG video frames, gemini-3.1-flash-live-preview — the same
 * model the reference app uses for its live session. The independent
 * videoStreamRef camera add/remove fix and the video-tracks-only stop
 * fix are both preserved exactly.
 */
import { useEffect, useRef, useState } from "react";
import { Video, X, Send, Keyboard } from "lucide-react";
import {
  GoogleGenAI, Modality, LIVE_MODEL,
  INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE, FRAME_RATE, JPEG_QUALITY,
  encodeBytes, decodeBytes, decodeAudioData, liveDoubtSystemPrompt,
  type LiveServerMessage, type Session, type LiveTextbookExtract,
} from "@/lib/gemini-live";
import type { TextbookContext } from "@/lib/textbook-context";
import { studentKey, orderedUsableKeys, markSuccess, markFailure, classifyLiveFailure, describePoolStatus } from "@/lib/student-key";
import { offlineAI } from "@/lib/offline-ai";
import { getSpeechLang } from "@/lib/web-speech";
import { boardName, languageInstruction, gradeBandGuidance } from "@/lib/teacher-prompts-client";
import { VoiceVisualizer } from "@/components/VoiceVisualizer";

type ConnStatus = "disconnected" | "connecting" | "connected" | "error";

interface Props {
  grade: string;
  boardId: string;
  languageId: string;
  teachingStyle?: "target_only" | "target_with_english_terms" | "simple_english";
  /** Optional now — when mounted globally (GlobalDoubtDock) the dock never
   *  unmounts, exactly like the reference app; the X just ends the session. */
  onClose?: () => void;
  /** The textbook/topic the student was last working with in RAG
   *  Classroom or Material Studio (lib/textbook-context.ts). When set,
   *  the live session is grounded in that book's indexed extracts —
   *  see fetchTextbookExtracts() below. Null/undefined means "no active
   *  textbook", and the session behaves exactly as before: reacting only
   *  to whatever the camera/mic show it. */
  textbookContext?: TextbookContext | null;
  /** A highlighted excerpt the student asked about from study materials
   *  elsewhere on the page (see lib/pending-doubt.ts). Prefills the text
   *  input so it's ready to send/speak about — doesn't auto-open the mic
   *  or camera, since starting those without an explicit tap is exactly
   *  the kind of thing that should stay a deliberate user action. */
  pendingQuestion?: string | null;
}

export function DoubtCameraMic({ grade, boardId, languageId, teachingStyle = "target_with_english_terms", onClose, textbookContext, pendingQuestion }: Props) {
  const [status,   setStatus]   = useState<ConnStatus>("disconnected");
  const [error,    setError]    = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isActivating,  setIsActivating]  = useState(false);
  const [isThinking,    setIsThinking]    = useState(false);
  const [cameraBusy,    setCameraBusy]    = useState(false); // adding/removing camera mid-session
  // True only for a session started via startTextOnlySession() — no mic/
  // camera was ever requested, so the UI must not show voice-specific
  // prompts ("Speak now...", "check mic/camera permissions") that would
  // be actively misleading for a student who only typed.
  const [textOnlyMode, setTextOnlyMode] = useState(false);

  const [userTranscription, setUserTranscription] = useState("");
  const [aiTranscription,   setAiTranscription]   = useState("");
  const [textInput, setTextInput] = useState("");

  // Prefill from a highlight-to-ask request (lib/pending-doubt.ts). Runs
  // whenever a *new* question comes in (guarded by askedAt via the parent
  // passing a fresh string each time) — doesn't fight with the student's
  // own typing if they're mid-sentence on something unrelated.
  useEffect(() => {
    if (pendingQuestion) setTextInput(pendingQuestion);
  }, [pendingQuestion]);

  // A Live session keeps the system prompt and speech locale it opened
  // with. Close an old session when the classroom language changes so
  // the next mic/camera tap starts with the newly selected language.
  const languageSessionRef = useRef(`${languageId}:${teachingStyle}`);
  useEffect(() => {
    const next = `${languageId}:${teachingStyle}`;
    if (languageSessionRef.current !== next) {
      languageSessionRef.current = next;
      stopHardware();
    }
  }, [languageId, teachingStyle]);

  // ── Textbook grounding — populated just before connecting, from
  // whatever document/topic is active in lib/textbook-context.ts. Kept
  // in state (rather than fetched inline in startAiSession) so the UI
  // can show a "grounded in <book>" badge while connecting/connected. ──
  const [textbookExtracts, setTextbookExtracts] = useState<LiveTextbookExtract[] | null>(null);

  // ── Offline fallback — no BYOK key, or the live connection failed, but
  // the on-device vision-capable model has been downloaded. See
  // lib/offline-ai.ts's downloadVision()/generateWithImage() — genuinely
  // uses the camera photo, not a text-only stand-in, verified against
  // the real wllama API rather than assumed. ──
  const [offlineMode,    setOfflineMode]    = useState(false);
  const [offlineStream,  setOfflineStream]  = useState<MediaStream | null>(null);
  const [offlineAsking,  setOfflineAsking]  = useState(false);
  const [offlineAnswer,  setOfflineAnswer]  = useState("");
  const [offlineError,   setOfflineError]   = useState("");
  const offlineVideoRef = useRef<HTMLVideoElement>(null);
  const offlineCanvasRef = useRef<HTMLCanvasElement>(null);

  const videoRef          = useRef<HTMLVideoElement>(null);
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const streamRef           = useRef<MediaStream | null>(null);      // audio-bearing stream — set once, for the session's lifetime
  const videoStreamRef      = useRef<MediaStream | null>(null);      // camera-only stream — independent, addable/removable mid-session
  const sessionRef          = useRef<Session | null>(null);
  const audioCtxRef         = useRef<AudioContext | null>(null);
  const outputAudioCtxRef   = useRef<AudioContext | null>(null);
  const frameIntervalRef    = useRef<number | null>(null);
  const nextStartTimeRef    = useRef(0);
  const sourcesRef          = useRef<Set<AudioBufferSourceNode>>(new Set());
  const userTranscriptRef   = useRef("");
  const aiTranscriptRef     = useRef("");

  const apiKey = studentKey.get();
  const micOrCameraOn = status !== "disconnected";

  // Proactively check/request permissions if needed.
  async function requestHardwarePermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.error("Permission request failed:", e);
    }
  }

  // ── Drag-and-drop: students can move the floating pane anywhere. ──────
  // Anchored by (left, bottom) — NOT top — so when the console card
  // appears/disappears above the dock, the pane grows upward and the
  // dock stays exactly where the student put it (same anchoring the
  // default CSS position uses). Position persists in localStorage so it
  // survives page navigation and reloads. Drag handles are the pill dock
  // and the console header; buttons/inputs/video/scroll areas inside
  // them are excluded so taps and scrolling still work normally.
  // Pointer Events (not mouse/touch pairs) — one code path that works
  // on both desktop and the budget Android touchscreens this app
  // targets, with setPointerCapture so fast drags don't escape the
  // handle. touch-action: none is set ONLY on the handle elements
  // (never the whole pane) so the transcript boxes remain scrollable.
  const DOCK_POS_KEY = "nexus-guru-dock-pos";
  const [dockPos, setDockPos] = useState<{ x: number; bottom: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number; startY: number;
    origX: number; origBottom: number;
    width: number; height: number;
  } | null>(null);

  const clampToViewport = (x: number, bottom: number, width: number, height: number) => ({
    x:      Math.min(Math.max(x, 8), Math.max(8, window.innerWidth  - width  - 8)),
    bottom: Math.min(Math.max(bottom, 8), Math.max(8, window.innerHeight - height - 8)),
  });

  // Restore the saved position once mounted (measure first so the saved
  // spot is re-clamped to THIS device's viewport, not the one it was
  // saved on — a phone position must not put the pane off-screen on a
  // laptop or vice versa).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DOCK_POS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { x: number; bottom: number };
      requestAnimationFrame(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setDockPos(clampToViewport(saved.x, saved.bottom, r.width, r.height));
      });
    } catch {}
  }, []);

  // Re-clamp when the pane's height changes (console opening, camera
  // preview appearing) or the window resizes, so a pane parked near the
  // top edge can't grow off-screen.
  useEffect(() => {
    const reclamp = () => {
      setDockPos(p => {
        if (!p) return p;
        const el = wrapperRef.current;
        if (!el) return p;
        const r = el.getBoundingClientRect();
        const c = clampToViewport(p.x, p.bottom, r.width, r.height);
        return (c.x === p.x && c.bottom === p.bottom) ? p : c;
      });
    };
    const raf = requestAnimationFrame(reclamp);
    window.addEventListener("resize", reclamp);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", reclamp); };
  }, [micOrCameraOn, cameraEnabled, offlineMode]);

  function startDrag(e: React.PointerEvent) {
    // Never hijack real interactions — buttons, inputs, links, the video
    // preview, or the scrollable transcript boxes.
    if ((e.target as HTMLElement).closest("button, input, a, video, .custom-scrollbar")) return;
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      origX: rect.left, origBottom: window.innerHeight - rect.bottom,
      width: rect.width, height: rect.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function moveDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    setDockPos(clampToViewport(
      d.origX + (e.clientX - d.startX),
      d.origBottom - (e.clientY - d.startY),
      d.width, d.height,
    ));
  }

  function endDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDockPos(p => {
      if (p) { try { localStorage.setItem(DOCK_POS_KEY, JSON.stringify(p)); } catch {} }
      return p;
    });
  }

  /** Spread onto each drag-handle element. */
  const dragHandleProps = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    style: { touchAction: "none" } as React.CSSProperties,
  };

  /** Inline override of .hardware-dock-center once the student has
   *  dragged the pane; before that, the default CSS position applies. */
  const dockPosStyle: React.CSSProperties | undefined = dockPos
    ? { left: dockPos.x, bottom: dockPos.bottom, top: "auto", transform: "none" }
    : undefined;

  useEffect(() => {
    return () => stopHardware();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleHardware(type: "camera" | "mic") {
    if (!apiKey) { setError("Set up your free Gemini key in Settings first."); return; }

    // ── Not connected yet: start the whole session (mic always, camera if requested) ──
    if (!micOrCameraOn) {
      setIsActivating(true); setError(null);
      const wantsCamera = type === "camera";
      let stream: MediaStream;
      // Permission errors and Gemini connection errors are different
      // failure domains — kept in separate try/catches so a quota/key
      // error is never mislabelled as a browser permission problem (or
      // vice versa).
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: wantsCamera ? { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } : false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsCamera });
        }
      } catch {
        setError("Allow camera/microphone access in your browser settings.");
        setStatus("disconnected");
        setIsActivating(false);
        return;
      }
      streamRef.current = stream;
      try {
        await startAiSession(stream);
        if (wantsCamera) await startVideoCapture(stream); // reuse the same stream's video track when starting fresh with camera on
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the doubt session. Please try again.");
        setStatus("disconnected");
      } finally {
        setIsActivating(false);
      }
      return;
    }

    // ── Already connected: camera button now ADDS or REMOVES video only,
    // never touches the audio session or ends the call. This is the fix —
    // previously this branch called stopHardware(), ending the whole
    // session just because the student wanted to turn the camera on. ──
    if (type === "camera") {
      setCameraBusy(true);
      try {
        if (cameraEnabled) {
          stopVideoCapture();
        } else {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          });
          await startVideoCapture(camStream);
        }
      } catch {
        setError("Allow camera access in your browser settings.");
      } finally {
        setCameraBusy(false);
      }
    }
  }

  // Fetches grounding extracts for the active textbook (if any) from the
  // plain-retrieval endpoint (no Gemini call — see app/api/rag/context).
  // Failure here should never block the voice session from starting, so
  // errors are swallowed and we just fall back to camera-only grounding.
  async function fetchTextbookExtracts(): Promise<LiveTextbookExtract[] | null> {
    if (!textbookContext?.documentId) return null;
    try {
      const r = await fetch("/api/rag/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: textbookContext.documentId, topic: textbookContext.topic, k: 6 }),
      });
      const x = await r.json();
      return r.ok && x.extracts?.length ? x.extracts : null;
    } catch {
      return null;
    }
  }

  /** stream is optional — omitted entirely for a text-only doubt session
   *  (see startTextOnlySession below), which needs a live Gemini
   *  connection but no microphone/camera permission at all. Everything
   *  below the session-connect call is audio-INPUT wiring only; Gemini's
   *  spoken replies still work fine without it, since audio OUTPUT
   *  (outputAudioCtxRef, in handleMessage) is set up independently and
   *  needs no input stream.
   *
   *  KEY ROTATION: previously this opened the Live socket with a single
   *  static key (studentKey.get(), captured once at render) and had no
   *  fallback at all — a quota error on that one key was a dead end even
   *  though the student had several other saved keys sitting unused.
   *  This now walks every currently-usable saved key in rotation order
   *  (connectLiveSession below) and only surfaces an error once ALL of
   *  them have failed, and that error names which keys were tried and
   *  why (describePoolStatus) instead of a bare "quota exceeded". */
  async function startAiSession(stream?: MediaStream) {
    setStatus("connecting");
    userTranscriptRef.current = ""; aiTranscriptRef.current = "";
    setUserTranscription(""); setAiTranscription("");

    const extracts = await fetchTextbookExtracts();
    setTextbookExtracts(extracts);

    const systemInstruction = liveDoubtSystemPrompt({
      grade,
      boardName: boardName(boardId),
      gradeGuidance: gradeBandGuidance(grade),
      languageLine: languageId === "malayalam" && teachingStyle === "target_with_english_terms"
        ? "Reply and speak mainly in Malayalam using Malayalam script. Keep only mathematical and scientific technical terms, formulas, symbols, and standard examination vocabulary in English. Never use English for the surrounding explanation."
        : languageInstruction(languageId),
      textbookName: textbookContext?.documentName,
      textbookTopic: textbookContext?.topic,
      textbookExtracts: extracts || undefined,
    });
    const liveConfig = {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: { languageCode: getSpeechLang(languageId), voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      systemInstruction,
    };

    const candidates = orderedUsableKeys();
    if (!candidates.length) {
      setStatus("error");
      throw new Error(
        studentKey.hasKey()
          ? `All ${studentKey.getAll().length} saved Gemini key(s) are unusable right now (${describePoolStatus()}). Add another key in Settings, or try again later.`
          : "Set up your free Gemini key in Settings first."
      );
    }

    let lastMessage = "Gemini live connection failed.";
    for (const candidate of candidates) {
      try {
        const session = await connectLiveSession(candidate.key, liveConfig);
        sessionRef.current = session;
        markSuccess(candidate.key);
        wireAudioInput(stream);
        return;
      } catch (e: any) {
        lastMessage = e?.message || lastMessage;
        const kind = classifyLiveFailure(lastMessage);
        markFailure(candidate.key, kind === "other" ? "temporary" : kind, lastMessage);
        // fall through to the next saved key
      }
    }

    setStatus("error");
    throw new Error(
      `Tried all ${candidates.length} saved Gemini key(s) — every one failed (${describePoolStatus()}). Last error: "${lastMessage}". Add another key in Settings, or try again later.`
    );
  }

  /** Opens one Live socket on ONE specific key and settles once we know
   *  whether it actually came up. connect() resolving is not by itself
   *  proof the key is good — Google can accept the socket and then close
   *  it almost immediately with a quota/auth reason — so this also waits
   *  through a short grace window after connect() resolves, and only
   *  resolves the outer promise if no onerror/onclose lands in that
   *  window. Any onerror/onclose AFTER that point (a real mid-session
   *  drop) is reported to the UI as normal instead of triggering
   *  rotation, since rotating mid-conversation would just start a new,
   *  contextless session. */
  function connectLiveSession(key: string, config: any): Promise<Session> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ai = new GoogleGenAI({ apiKey: key });

      ai.live.connect({
        model: LIVE_MODEL,
        config,
        callbacks: {
          onopen: () => { setStatus("connected"); setIsThinking(false); },
          onmessage: (msg: LiveServerMessage) => handleMessage(msg),
          onerror: (e: any) => {
            setIsThinking(false);
            const message = e?.message || "Gemini live connection error";
            if (!settled) { settled = true; reject(new Error(message)); }
            else { setStatus("error"); setError(`Doubt session error (key ${studentKey.masked(key)}): ${message}`); }
          },
          onclose: (e: any) => {
            setIsThinking(false);
            const reason = e?.reason || "";
            if (!settled) { settled = true; reject(new Error(reason || "Gemini live connection closed before it opened.")); }
            else { setStatus("disconnected"); }
          },
        },
      }).then(session => {
        // Give an onerror/onclose fired right after accept a brief
        // window to arrive before treating this key as good.
        window.setTimeout(() => {
          if (!settled) { settled = true; resolve(session); }
        }, 600);
      }).catch(err => {
        if (!settled) { settled = true; reject(err instanceof Error ? err : new Error(String(err?.message || err || "Gemini live connect() failed"))); }
      });
    });
  }

  // ── Audio input: mic -> 16kHz PCM -> Gemini — set up once a session is
  // open, and only when a real mic stream exists. A text-only session
  // (startTextOnlySession) never requests one, so there's nothing to
  // wire here — sendTextMessage() below still works fine either way. ──
  function wireAudioInput(stream?: MediaStream) {
    if (!stream) return;
    const audioCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    const source    = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    const analyser  = audioCtx.createAnalyser();
    source.connect(analyser);

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) pcm[i] = input[i] * 32767;
      sessionRef.current?.sendRealtimeInput({
        audio: { data: encodeBytes(new Uint8Array(pcm.buffer)), mimeType: "audio/pcm;rate=16000" },
      });
      const level = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(level);
      setMicLevel(level.reduce((a, b) => a + b, 0) / level.length / 128);
    };
    source.connect(processor);
    processor.connect(audioCtx.destination);
    audioCtxRef.current = audioCtx;
  }

  /** Opens a live Gemini session with NO microphone or camera permission
   *  requested at all — for a student who just wants to type a doubt.
   *  Same system prompt, same textbook grounding, same conversation
   *  (Gemini can still reply by voice — see startAiSession's comment on
   *  why that doesn't need an input stream), just no hardware. The
   *  camera/mic buttons remain available afterwards to add either one
   *  mid-session, same as starting from voice/camera would allow. */
  async function startTextOnlySession() {
    if (!apiKey) { setError("Set up your free Gemini key in Settings first."); return; }
    if (micOrCameraOn) return;
    setIsActivating(true); setError(null); setTextOnlyMode(true);
    try {
      await startAiSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the doubt session. Please try again.");
      setStatus("disconnected");
      setTextOnlyMode(false);
    } finally {
      setIsActivating(false);
    }
  }

  /** Starts capturing + streaming video frames from the given stream —
   *  callable at initial session start OR added mid-session, independent
   *  of the audio pipeline. */
  async function startVideoCapture(camStream: MediaStream) {
    videoStreamRef.current = camStream;
    setCameraEnabled(true);
    if (videoRef.current) {
      videoRef.current.srcObject = camStream;
      await videoRef.current.play().catch(() => {});
    }
    frameIntervalRef.current = window.setInterval(() => {
      if (!videoRef.current || videoRef.current.videoWidth === 0 || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      canvasRef.current.width = 1024;
      canvasRef.current.height = 768;
      ctx.drawImage(videoRef.current, 0, 0, 1024, 768);
      canvasRef.current.toBlob(blob => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          sessionRef.current?.sendRealtimeInput({ video: { data: base64, mimeType: "image/jpeg" } });
        };
        reader.readAsDataURL(blob);
      }, "image/jpeg", JPEG_QUALITY);
    }, 1000 / FRAME_RATE);
  }

  /** Stops video only — audio session and Gemini connection stay
   *  untouched. Deliberately stops ONLY video tracks (never the blanket
   *  getTracks()) — when a session starts with camera already on,
   *  videoStreamRef and streamRef point at the same combined stream, so
   *  stopping "all tracks" here would have silently killed the
   *  microphone too. Found this by tracing the shared-stream case, not
   *  by assuming the two refs were always independent. */
  function stopVideoCapture() {
    if (frameIntervalRef.current !== null) clearInterval(frameIntervalRef.current);
    frameIntervalRef.current = null;
    videoStreamRef.current?.getVideoTracks().forEach(t => t.stop());
    videoStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraEnabled(false);
  }

  /** Sends a typed message into the SAME live conversation as voice/camera
   *  — sendClientContent() is the correct API for a single text turn
   *  (verified against the real @google/genai type definitions), distinct
   *  from sendRealtimeInput() used for the continuous audio/video streams. */
  function sendTextMessage() {
    const text = textInput.trim();
    if (!text || !sessionRef.current) return;
    sessionRef.current.sendClientContent({ turns: text, turnComplete: true });
    userTranscriptRef.current = text;
    setUserTranscription(text);
    setIsThinking(true);
    setTextInput("");
  }

  async function handleMessage(msg: LiveServerMessage) {
    const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      if (!outputAudioCtxRef.current) outputAudioCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      const ctx = outputAudioCtxRef.current;
      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
      const buffer = await decodeAudioData(decodeBytes(base64Audio), ctx);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(nextStartTimeRef.current);
      src.onended = () => sourcesRef.current.delete(src);
      nextStartTimeRef.current += buffer.duration;
      sourcesRef.current.add(src);
      setIsThinking(false);
    }

    if (msg.serverContent?.inputTranscription?.text) {
      userTranscriptRef.current = (userTranscriptRef.current + " " + msg.serverContent.inputTranscription.text).trim();
      setUserTranscription(userTranscriptRef.current);
      setIsThinking(true);
    }
    if (msg.serverContent?.outputTranscription?.text) {
      setIsThinking(false);
      aiTranscriptRef.current = (aiTranscriptRef.current + " " + msg.serverContent.outputTranscription.text).trim();
      setAiTranscription(aiTranscriptRef.current);
    }
    if (msg.serverContent?.turnComplete) {
      userTranscriptRef.current = ""; aiTranscriptRef.current = "";
      setUserTranscription(""); setAiTranscription("");
      setIsThinking(false);
    }
  }

  function stopHardware() {
    stopVideoCapture();
    sessionRef.current?.close();
    sessionRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    outputAudioCtxRef.current?.close().catch(() => {});
    outputAudioCtxRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStatus("disconnected");
    setMicLevel(0);
    setIsThinking(false);
    setUserTranscription(""); setAiTranscription("");
    setTextInput("");
    setTextbookExtracts(null);
    setTextOnlyMode(false);
  }

  function handleClose() {
    stopHardware();
    stopOfflineMode();
    onClose?.();
  }

  // ── Offline fallback handlers ──────────────────────────────────────────

  async function startOfflineMode() {
    setOfflineError(""); setOfflineAnswer("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      setOfflineStream(stream);
      setOfflineMode(true);
      if (offlineVideoRef.current) {
        offlineVideoRef.current.srcObject = stream;
        await offlineVideoRef.current.play().catch(() => {});
      }
    } catch {
      setOfflineError("Allow camera access to use offline mode.");
    }
  }

  function stopOfflineMode() {
    offlineStream?.getTracks().forEach(t => t.stop());
    setOfflineStream(null);
    setOfflineMode(false);
    setOfflineAnswer(""); setOfflineError("");
    window.speechSynthesis?.cancel();
  }

  async function askOffline() {
    if (!textInput.trim() || !offlineVideoRef.current || offlineVideoRef.current.videoWidth === 0) return;
    setOfflineAsking(true); setOfflineError(""); setOfflineAnswer("");
    window.speechSynthesis?.cancel();
    try {
      // Capture ONE frame on demand — offline mode is snapshot-based, not
      // continuous streaming (a genuinely different, honest capability
      // from the live Gemini mode above, not a lesser copy of it).
      const canvas = offlineCanvasRef.current!;
      canvas.width = 1024; canvas.height = 768;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(offlineVideoRef.current, 0, 0, 1024, 768);
      const imageBytes: ArrayBuffer = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error("Could not capture the camera frame.")); return; }
          blob.arrayBuffer().then(resolve, reject);
        }, "image/jpeg", 0.85);
      });

      const system = `You are AI Guru, a warm and patient Indian school maths teacher, running fully offline on this device. You are teaching a Class ${grade} student who follows the ${boardName(boardId)} syllabus.
${gradeBandGuidance(grade)}
${languageId === "malayalam" && teachingStyle === "target_with_english_terms" ? "Answer mainly in Malayalam script, keeping mathematical and scientific technical terms in English." : languageInstruction(languageId)}
The student has shown you a photo of their textbook or notebook and asked a question. Look at the photo carefully and answer clearly and briefly.`;

      const answer = await offlineAI.generateWithImage(system, textInput.trim(), imageBytes);
      setOfflineAnswer(answer.trim());
      setTextInput("");

      // Read the answer aloud — Web Speech is the only TTS mechanism in
      // this app (see lib/web-speech.ts); genuinely works offline too on
      // most devices, since the voices are typically installed locally.
      if ("speechSynthesis" in window && answer.trim()) {
        const utterance = new SpeechSynthesisUtterance(answer.trim());
        utterance.lang = getSpeechLang(languageId);
        window.speechSynthesis.speak(utterance);
      }
    } catch (e: any) {
      setOfflineError(e.message || "Could not get an answer. Try again.");
    } finally {
      setOfflineAsking(false);
    }
  }

  // ── Offline mode has its own, simpler, self-contained UI — rendered as
  // an early return so the live Gemini UI below is completely untouched.
  // Styled in the reference pane's exact palette (#050915 navy card,
  // indigo/amber accents) so both modes look like one design. ──
  if (offlineMode) {
    return (
      <div ref={wrapperRef} style={dockPosStyle} className="hardware-dock-center flex flex-col items-center gap-5 z-[1000] w-[calc(100%-80px)] sm:w-auto max-w-xs sm:max-w-md px-4 sm:px-6 pointer-events-none">
        <div className="w-full sm:w-80 pointer-events-auto">
          <div className="w-full bg-[#050915]/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-4 flex flex-col gap-3 text-center select-none relative">
            <div className="absolute -top-6 -left-6 w-24 h-24 bg-indigo-500/5 blur-[30px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-500/5 blur-[30px] rounded-full pointer-events-none" />

            <div {...dragHandleProps} className="flex items-center justify-between border-b border-white/5 pb-2 w-full z-10 select-none cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
                  Offline mode — running on this device
                </span>
              </div>
              <button
                onClick={() => { stopOfflineMode(); onClose?.(); }}
                className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <video ref={offlineVideoRef} autoPlay playsInline muted
              className="w-full rounded-xl border border-white/10 z-10" />
            <canvas ref={offlineCanvasRef} className="hidden" />

            {offlineAnswer && (
              <div className="bg-[#0c0f1b]/95 border border-indigo-500/10 rounded-xl p-3 max-h-56 overflow-y-auto custom-scrollbar shadow-inner z-10 text-left">
                <div className="text-[9px] font-black uppercase text-amber-500 tracking-widest mb-1 select-none">
                  Ai-Guru (offline) response
                </div>
                <div className="text-[12px] leading-relaxed text-slate-200 select-text whitespace-pre-wrap font-sans">{offlineAnswer}</div>
              </div>
            )}

            {offlineAsking && (
              <div className="bg-[#0b0f19]/60 border border-indigo-500/5 rounded-xl p-2.5 flex items-center gap-2 animate-pulse z-10">
                <div className="flex gap-0.5 h-2.5 items-end shrink-0">
                  <span className="w-0.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms] h-1.5" />
                  <span className="w-0.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:150ms] h-2.5" />
                  <span className="w-0.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms] h-1.5" />
                </div>
                <p className="text-[9px] text-indigo-300 italic font-bold uppercase tracking-wider">Thinking (on-device)…</p>
              </div>
            )}

            {offlineError && <div className="text-[10px] text-rose-400 z-10">{offlineError}</div>}

            <div className="flex items-center gap-2 border-t border-white/5 pt-2.5 z-10">
              <input
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && askOffline()}
                placeholder="Point the camera at your problem, then type your question…"
                disabled={offlineAsking}
                className="flex-1 rounded-lg border border-white/10 bg-[#0c0f1b] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40 disabled:opacity-60"
              />
              <button onClick={askOffline} disabled={!textInput.trim() || offlineAsking}
                className="shrink-0 rounded-lg bg-amber-500 p-2 text-[#050915] hover:bg-amber-400 disabled:opacity-40 transition-colors">
                <Send size={14} />
              </button>
            </div>
            <p className="text-center text-[9px] text-slate-500 z-10">
              Snapshot-based, not live video — captures one photo per question, works fully offline.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  FLOATING PANE — verbatim copy of the reference "GLOBAL HARDWARE DOCK"
  //  (console + pill dock). Do not restyle.
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} style={dockPosStyle} className="hardware-dock-center flex flex-col items-center gap-5 z-[1000] w-[calc(100%-80px)] sm:w-auto max-w-xs sm:max-w-md px-4 sm:px-6 pointer-events-none animate-in slide-in-from-bottom-5 duration-500">

      {/* Hidden canvas for frame capture (logic unchanged) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* COMPACT FLOATING VOICE & SIGHT CONSOLE AREA - RENDERED DIRECTLY ABOVE CONTROLS */}
      {micOrCameraOn && (
        <div id="immersive-voice-sight-console" className="w-full sm:w-80 pointer-events-auto animate-in fade-in slide-in-from-bottom-6 duration-300">
          <div className="w-full bg-[#050915]/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-4 flex flex-col gap-3 text-center select-none relative animate-in zoom-in-95 duration-200">

            {/* Subtle internal glowing spots */}
            <div className="absolute -top-6 -left-6 w-24 h-24 bg-indigo-500/5 blur-[30px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-500/5 blur-[30px] rounded-full pointer-events-none" />

            {/* Header controls — also the drag handle to move the pane */}
            <div {...dragHandleProps} className="flex items-center justify-between border-b border-white/5 pb-2 w-full z-10 select-none cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  status === "connected" ? "bg-emerald-500 animate-pulse" :
                  status === "connecting" ? "bg-amber-500 animate-pulse" : "bg-rose-500"
                }`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
                  {status === "connected" ? "Secure Voice Channel" :
                   status === "connecting" ? "Bridging Vocals..." : "Offline"}
                </span>
              </div>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Close Vocal Feed"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Grounding badge — shows which indexed textbook this session is
                using, when one is active (see lib/textbook-context.ts). Only
                shown once connecting/connected so it doesn't flash before we
                know whether extracts actually came back. */}
            {textbookContext?.documentName && (status === "connecting" || status === "connected") && (
              <div className="w-full text-left rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1.5 z-10">
                <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-300">
                  {textbookExtracts?.length ? "Grounded in" : "Textbook active (no matching extracts)"}
                </p>
                <p className="truncate text-[11px] text-slate-300">
                  {textbookContext.documentName}
                  {textbookContext.topic ? ` · ${textbookContext.topic}` : ""}
                </p>
              </div>
            )}

            {/* Compact camera preview — the student aims this at their
                textbook; this app has no separate large workspace camera,
                so the preview lives here (reference-matching styling). */}
            <video ref={videoRef} autoPlay playsInline muted
              className={`w-full rounded-xl border border-white/10 z-10 ${cameraEnabled ? "block" : "hidden"}`} />

            {/* GRAPHIC INDICATOR: VoiceVisualizer — meaningless with no mic
                input, so skip it entirely in text-only mode rather than
                show a permanently-flat waveform. */}
            {!textOnlyMode && (
              <div className="w-full flex items-center justify-center py-1 z-10 select-none">
                <VoiceVisualizer
                  volume={micLevel}
                  isModelSpeaking={!!aiTranscription}
                  isConnected={status === "connected"}
                  isThinking={isThinking}
                />
              </div>
            )}

            {/* DYNAMIC TEXT AREA: Resizes automatically */}
            <div className="w-full flex flex-col gap-2 z-10 text-left select-text">
              {/* Spoken Query of the user */}
              {userTranscription && (
                <div className="text-xs font-semibold text-indigo-300 italic tracking-wide max-h-24 overflow-y-auto custom-scrollbar select-text leading-relaxed px-1">
                  "{userTranscription}"
                </div>
              )}

              {/* AI Reply or Thinking Status */}
              {aiTranscription ? (
                <div className="bg-[#0c0f1b]/95 border border-indigo-500/10 rounded-xl p-3 max-h-56 overflow-y-auto custom-scrollbar shadow-inner animate-in fade-in duration-300">
                  <div className="text-[9px] font-black uppercase text-amber-500 tracking-widest mb-1 select-none">
                    Ai-Guru response
                  </div>
                  <div className="text-[12px] leading-relaxed text-slate-200 select-text whitespace-pre-wrap font-sans">
                    {aiTranscription}
                  </div>
                </div>
              ) : isThinking ? (
                <div className="bg-[#0b0f19]/60 border border-indigo-500/5 rounded-xl p-2.5 flex items-center gap-2 animate-pulse">
                  <div className="flex gap-0.5 h-2.5 items-end shrink-0">
                    <span className="w-0.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms] h-1.5" />
                    <span className="w-0.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:150ms] h-2.5" />
                    <span className="w-0.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms] h-1.5" />
                  </div>
                  <p className="text-[9px] text-indigo-300 italic font-bold uppercase tracking-wider">Formulating response...</p>
                </div>
              ) : status === "error" ? (
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-2.5">
                  <div className="text-[9px] font-black uppercase text-rose-400 tracking-widest mb-0.5 select-none">
                    ⚠️ {textOnlyMode ? "Connection Fault" : "Stream Permission Fault"}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    {textOnlyMode ? "Could not reach AI Guru. Check your connection and try again." : "Check browser permissions for microphone and camera."}
                  </p>
                </div>
              ) : !userTranscription && (
                <div className="text-[10px] text-slate-500 italic text-center py-1 select-none border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                  {textOnlyMode ? "⌨️ Type your doubt below..." : "🎙️ Speak Malayalam or English now..."}
                </div>
              )}
            </div>

            {/* ── Text input — same panel, same live conversation as
                voice/camera (kept feature, reference-matching styling) ── */}
            {status === "connected" && (
              <div className="z-10 flex items-center gap-2 border-t border-white/5 pt-2.5">
                <input
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendTextMessage()}
                  placeholder="Or type your doubt…"
                  className="flex-1 rounded-lg border border-white/10 bg-[#0c0f1b] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40"
                />
                <button onClick={sendTextMessage} disabled={!textInput.trim()}
                  className="shrink-0 rounded-lg bg-amber-500 p-2 text-[#050915] hover:bg-amber-400 disabled:opacity-40 transition-colors">
                  <Send size={14} />
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Setup / error hints + offline fallback entry point (kept features,
          reference-matching styling; only shown when relevant) */}
      {error && (
        <div className="pointer-events-auto text-[10px] text-rose-400 text-center bg-[#050915]/95 border border-rose-500/10 rounded-xl px-3 py-1.5">{error}</div>
      )}
      {!apiKey && (
        <div className="pointer-events-auto text-[10px] text-rose-400 text-center bg-[#050915]/95 border border-rose-500/10 rounded-xl px-3 py-1.5">
          Set up your free Gemini key in Settings to use this.
        </div>
      )}
      {(!apiKey || status === "error") && offlineAI.getVisionStatus() === "ready" && (
        <button onClick={startOfflineMode}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 hover:bg-indigo-500/20 transition-colors">
          <Video size={11} /> Try offline AI instead (no internet needed)
        </button>
      )}

      <div {...dragHandleProps} className="bg-black/90 backdrop-blur-3xl p-2.5 sm:p-4 rounded-[2.2rem] sm:rounded-[3rem] border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.95)] flex items-center gap-3 sm:gap-4 pointer-events-auto cursor-grab active:cursor-grabbing">
        <button
          onClick={() => toggleHardware("camera")}
          disabled={isActivating || cameraBusy}
          className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-500 border-2 cursor-pointer disabled:opacity-50 ${
            cameraEnabled ? "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_30px_rgba(79,70,229,0.6)] transform scale-110" : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
          }`}
          title={cameraEnabled ? "Turn off Camera stream" : "Turn on Camera stream"}
        >
          <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Text-only entry point — connects the same live session with no
            mic/camera permission requested at all, for a student who just
            wants to type. Hidden once any session is active (same as the
            mic button below), since at that point the text field is
            already visible inside the console instead. */}
        {!micOrCameraOn && (
          <button
            onClick={startTextOnlySession}
            disabled={isActivating}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-500 border-2 cursor-pointer disabled:opacity-50 bg-amber-500/10 border-amber-500/20 text-amber-500 hover:text-amber-400"
            title="Type a doubt instead"
          >
            <Keyboard className="w-5 h-5 sm:w-7 sm:h-7" />
          </button>
        )}

        {micOrCameraOn ? (
          <button
            onClick={handleClose}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 bg-rose-500 border border-rose-400 text-white shadow-[0_0_25px_rgba(239,68,68,0.5)] cursor-pointer transform hover:scale-105 active:scale-95"
            title="Close Voice/Sight bridge"
          >
            <X className="w-5 h-5 sm:w-7 sm:h-7" />
          </button>
        ) : (
          <button
            onClick={() => toggleHardware("mic")}
            disabled={isActivating}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-500 border-2 cursor-pointer disabled:opacity-50 bg-rose-500/10 border-rose-500/20 text-rose-500 hover:text-rose-400"
            title="Initiate Voice bridge"
          >
            <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        )}

        <div className="hidden sm:block h-10 w-px bg-white/10 mx-2 sm:mx-3" />
        <div className="hidden sm:flex px-2 sm:px-6 flex-col justify-center select-none">
           <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 leading-none">NEXUS LINK</span>
           <span className="text-[9px] font-bold uppercase tracking-widest mt-2 flex items-center gap-1.5">
             <span className={`w-1.5 h-1.5 rounded-full ${
               micOrCameraOn
                 ? (status === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse")
                 : "bg-slate-500"
             }`} />
             <span className={
               micOrCameraOn
                 ? (status === "connected" ? "text-emerald-400" : "text-amber-400")
                 : "text-slate-500"
             }>
               {micOrCameraOn
                 ? (status === "connected" ? "ACTIVE" : "BRIDGING...")
                 : "OFFLINE"}
             </span>
           </span>
        </div>
      </div>
    </div>
  );
}
