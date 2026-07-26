"use client";
/**
 * Homework — a quick text chat with AI Guru, separate from the
 * multi-segment Study Materials courses and separate from the live
 * camera+mic voice channel (DoubtCameraMic). This is deliberately a
 * one-shot chat, not a persisted course: type a question, or attach a
 * photo of a problem from the textbook/notebook, get an answer.
 *
 * Every AI reply has five actions: Copy, Download, Delete, Translate,
 * and Read Aloud — none of these needed a new backend beyond what
 * already exists in the app (the browser's Web Speech API for voice,
 * lib/web-speech.ts, and the same BYOK Gemini vision call used
 * elsewhere for the photo capture).
 *
 * Conversation is client-side/session-only (React state) — same pattern
 * as Classroom's "Ask AI Guru" Q&A and the live doubt-clearing
 * panel, neither of which persist to Firestore either. A homework
 * question is a one-off, not something that needs cross-device history.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Paperclip, X, Loader2, Copy, Download, Trash2, Languages,
  Volume2, VolumeX, Check, Camera,
} from "lucide-react";
import { PageHeader } from "@/components/ui";
import { studentSession } from "@/lib/student-session";
import { restoreStudentSession } from "@/lib/client/restore-student-session";
import { studentKey, callGeminiClient, callGeminiClientStream } from "@/lib/student-key";
import { getSpeechLang } from "@/lib/web-speech";
import { SUPPORTED_LANGUAGES, isRtlLanguage } from "@/lib/languages";
import { languageInstruction, gradeBandGuidance } from "@/lib/teacher-prompts-client";

interface ChatMessage {
  id: string;
  from: "student" | "ai";
  text: string;
  imagePreview?: string;   // object URL, student's attached photo, shown in their own bubble
  translatedText?: string;
  translatedLang?: string;
}

const LANGUAGES = SUPPORTED_LANGUAGES.map(l => ({ id: l.id, label: l.label }));

function homeworkSystemPrompt(grade: string, boardId: string, languageId: string) {
  return `You are AI Guru, a patient homework-help teacher for a Class ${grade} student.
${gradeBandGuidance(grade)}
${languageInstruction(languageId)}
The student may type a question, or attach a photo of a problem from their textbook or notebook. If a photo is attached, look at it carefully — read any text, numbers, or diagrams — and answer based on exactly what's shown, not what you assume.
Explain clearly with real reasoning, not just the final answer. Keep it focused and readable — a few short paragraphs at most, not an essay. Plain text only, no markdown symbols.`;
}

function translatePrompt(targetLanguageLabel: string) {
  return `Translate the given text into ${targetLanguageLabel}, in its native script. Keep the meaning and tone exactly the same — this is a translation, not a rewrite or summary. Output ONLY the translated text, nothing else.`;
}

export default function HomeworkPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(() => studentSession.get());

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [langMenuFor, setLangMenuFor] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fast path already covered by the useState initializer above — this
    // only runs the (async) server fallback when localStorage came up
    // empty, so a lost-but-recoverable profile self-heals instead of
    // bouncing straight to /login.
    if (profile) return;
    let cancelled = false;
    (async () => {
      const restored = await restoreStudentSession();
      if (cancelled) return;
      if (restored) setProfile(restored);
      else router.push("/login");
    })();
    return () => { cancelled = true; };
  }, [profile, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  if (!profile) return null;

  function pickFile(file: File | null | undefined) {
    if (!file) return;
    setAttachedFile(file);
    setAttachPreview(URL.createObjectURL(file));
  }
  function clearAttachment() {
    if (attachPreview) URL.revokeObjectURL(attachPreview);
    setAttachedFile(null); setAttachPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function send() {
    if ((!input.trim() && !attachedFile) || sending) return;
    const question = input.trim() || "Please look at this photo and help me with this problem.";
    const byokKey = studentKey.get();
    if (!byokKey) {
      setMessages(m => [...m, {
        id: crypto.randomUUID(), from: "ai",
        text: "Set up your free Gemini key in Settings first — Homework needs it to answer your questions.",
      }]);
      return;
    }

    const studentMsg: ChatMessage = {
      id: crypto.randomUUID(), from: "student", text: question,
      imagePreview: attachPreview || undefined,
    };
    setMessages(m => [...m, studentMsg]);
    setInput(""); setSending(true);
    const fileToSend = attachedFile;
    clearAttachment();

    // Placeholder created up front — the typing indicator shows only
    // until the FIRST chunk arrives, then this message's text grows in
    // place as more chunks stream in, the way a person typing would look.
    const aiMessageId = crypto.randomUUID();
    let receivedFirstChunk = false;

    try {
      const system = homeworkSystemPrompt(profile!.grade, profile!.syllabus, profile!.languageId);
      const image = fileToSend ? { base64: await fileToBase64(fileToSend), mimeType: fileToSend.type } : undefined;

      await callGeminiClientStream(system, question, byokKey, (delta) => {
        if (!receivedFirstChunk) {
          receivedFirstChunk = true;
          setMessages(m => [...m, { id: aiMessageId, from: "ai", text: delta }]);
        } else {
          setMessages(m => m.map(msg => msg.id === aiMessageId ? { ...msg, text: msg.text + delta } : msg));
        }
      }, image);
    } catch (e: any) {
      const errorText = `Sorry, I couldn't answer that — ${e.message || "please try again."}`;
      if (receivedFirstChunk) {
        // Partial answer already streamed in before the error — keep it
        // visible and append the error, rather than discarding real
        // partial progress the student already saw.
        setMessages(m => m.map(msg => msg.id === aiMessageId ? { ...msg, text: msg.text + `\n\n[${errorText}]` } : msg));
      } else {
        setMessages(m => [...m, { id: aiMessageId, from: "ai", text: errorText }]);
      }
    } finally {
      setSending(false);
    }
  }

  function deleteMessage(id: string) {
    setMessages(m => m.filter(msg => msg.id !== id));
  }

  async function copyMessage(msg: ChatMessage) {
    const text = msg.translatedText || msg.text;
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function downloadMessage(msg: ChatMessage) {
    const text = msg.translatedText || msg.text;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ai-guru-answer.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  async function translateMessage(msg: ChatMessage, langId: string) {
    setLangMenuFor(null);
    const byokKey = studentKey.get();
    if (!byokKey) return;
    setTranslatingId(msg.id);
    try {
      const targetLabel = LANGUAGES.find(l => l.id === langId)?.label || langId;
      const translated = await callGeminiClient(translatePrompt(targetLabel), msg.text, byokKey);
      setMessages(m => m.map(x => x.id === msg.id ? { ...x, translatedText: translated.trim(), translatedLang: langId } : x));
    } catch {
      // fails silently — original text remains shown, translation just doesn't appear
    } finally {
      setTranslatingId(null);
    }
  }

  function clearTranslation(id: string) {
    setMessages(m => m.map(x => x.id === id ? { ...x, translatedText: undefined, translatedLang: undefined } : x));
  }

  function readAloud(msg: ChatMessage) {
    if (playingId === msg.id) {
      window.speechSynthesis?.cancel();
      setPlayingId(null);
      return;
    }
    window.speechSynthesis?.cancel();

    const text = msg.translatedText || msg.text;
    const langId = msg.translatedLang || profile!.languageId;

    if (!("speechSynthesis" in window)) return; // no TTS available on this browser at all
    setPlayingId(msg.id);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLang(langId);
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div>
      <PageHeader eyebrow="Homework Help" title="Ask AI Guru" subtitle="Type a question, or show a photo of the problem — get a clear answer." />

      <div className="rounded-2xl border border-board3 bg-board2 flex flex-col overflow-hidden" style={{ height: 560 }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-xs">
                <Camera size={28} className="mx-auto mb-3 text-marigold" />
                <p className="text-sm text-chalkdim">
                  Ask about anything you're stuck on, or attach a photo of the problem from your textbook or notebook.
                </p>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.from === "student" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.from === "student" ? "bg-blue text-board rounded-br-sm" : "bg-board3 text-chalk rounded-bl-sm"
              }`}>
                {msg.imagePreview && (
                  <img src={msg.imagePreview} alt="attached problem" className="mb-2 max-h-40 rounded-lg border border-board3 object-cover" />
                )}
                <div className="whitespace-pre-wrap" dir={isRtlLanguage(msg.translatedLang || profile!.languageId) ? "rtl" : "ltr"}>
                  {msg.translatedText || msg.text}
                </div>
                {msg.translatedText && (
                  <button onClick={() => clearTranslation(msg.id)} className="mt-1.5 font-mono text-[9px] text-chalkdim hover:text-chalk underline">
                    Show original
                  </button>
                )}
              </div>

              {/* Actions — AI messages only */}
              {msg.from === "ai" && (
                <div className="mt-1.5 flex items-center gap-1 relative">
                  <button onClick={() => copyMessage(msg)} title="Copy"
                    className="p-1.5 rounded-md text-chalkdim hover:text-chalk hover:bg-board3">
                    {copiedId === msg.id ? <Check size={13} className="text-marigold" /> : <Copy size={13} />}
                  </button>
                  <button onClick={() => downloadMessage(msg)} title="Download"
                    className="p-1.5 rounded-md text-chalkdim hover:text-chalk hover:bg-board3">
                    <Download size={13} />
                  </button>
                  <button onClick={() => readAloud(msg)} title="Read aloud"
                    className="p-1.5 rounded-md text-chalkdim hover:text-chalk hover:bg-board3">
                    {playingId === msg.id ? <VolumeX size={13} className="text-marigold" /> : <Volume2 size={13} />}
                  </button>
                  <div className="relative">
                    <button onClick={() => setLangMenuFor(langMenuFor === msg.id ? null : msg.id)} title="Translate"
                      className="p-1.5 rounded-md text-chalkdim hover:text-chalk hover:bg-board3">
                      {translatingId === msg.id ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
                    </button>
                    {langMenuFor === msg.id && (
                      <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-board3 bg-board2 shadow-xl py-1 w-32">
                        {LANGUAGES.map(l => (
                          <button key={l.id} onClick={() => translateMessage(msg, l.id)}
                            className="block w-full text-left px-3 py-1.5 text-xs text-chalkdim hover:text-chalk hover:bg-board3">
                            {l.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => deleteMessage(msg.id)} title="Delete"
                    className="p-1.5 rounded-md text-chalkdim hover:text-terracotta hover:bg-board3">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {sending && messages[messages.length - 1]?.from === "student" && (
            <div className="flex items-start">
              <div className="rounded-2xl rounded-bl-sm bg-board3 px-3.5 py-2.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-chalkdim animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-chalkdim animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-chalkdim animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-board3 p-3 shrink-0">
          {attachedFile && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-board3 bg-board px-2.5 py-1.5">
              {attachPreview && <img src={attachPreview} alt="preview" className="h-8 w-8 rounded object-cover" />}
              <span className="flex-1 truncate text-xs text-chalk">{attachedFile.name}</span>
              <button onClick={clearAttachment} className="text-chalkdim hover:text-terracotta"><X size={13} /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} title="Show a photo of the problem"
              className="shrink-0 rounded-lg border border-board3 p-2.5 text-chalkdim hover:text-chalk hover:border-marigold/50">
              <Paperclip size={15} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => pickFile(e.target.files?.[0])} />
            <input
              className="flex-1 rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
              placeholder="Ask your question…"
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()} />
            <button onClick={send} disabled={(!input.trim() && !attachedFile) || sending}
              className="shrink-0 rounded-lg bg-marigold p-2.5 text-board hover:bg-marigolddim disabled:opacity-50">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
