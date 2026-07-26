"use client";
/**
 * Live chat with support — not a ticket list. A bot responds instantly
 * to every message (real chat feel, no waiting for an admin to be
 * online); once an admin actually replies in a thread, the bot goes
 * quiet there and a human takes over (lib/messages-store.ts's
 * adminHasReplied). Screenshots/files can be attached to show a
 * problem — the bot can actually look at attached images.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Send, Plus, Paperclip, X, FileText, Bot, User, Headset,
} from "lucide-react";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { studentSession } from "@/lib/student-session";
import { restoreStudentSession } from "@/lib/client/restore-student-session";

interface ThreadMessage {
  id: string; from: "student" | "admin" | "bot"; text: string; sentAt: string;
  attachmentUrl?: string; attachmentName?: string; attachmentType?: string;
}
interface Thread {
  id: string; subject: string; status: "open" | "resolved";
  messages: ThreadMessage[]; updatedAt: string; adminHasReplied: boolean;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function SenderIcon({ from }: { from: ThreadMessage["from"] }) {
  if (from === "student") return <User size={11} />;
  if (from === "bot")     return <Bot size={11} />;
  return <Headset size={11} />;
}
function senderLabel(from: ThreadMessage["from"]) {
  return from === "student" ? "You" : from === "bot" ? "Guru Bot" : "Support Team";
}

export default function StudentMessagesPage() {
  const router = useRouter();
  const [threads,  setThreads]  = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [composing, setComposing] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newText,    setNewText]    = useState("");
  const [reply,      setReply]      = useState("");
  const [sending,    setSending]    = useState(false);
  const [botTyping,  setBotTyping]  = useState(false);

  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState(() => studentSession.get());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = profile || await restoreStudentSession();
      if (cancelled) return;
      if (!p) { router.push("/login"); return; }
      if (!profile) setProfile(p);
      load(p);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [selected?.messages.length, botTyping]);

  async function load(activeProfile = profile) {
    if (!activeProfile) return;
    setLoading(true);
    const res = await fetch(`/api/student/messages?email=${encodeURIComponent(activeProfile.email)}`);
    const data = await res.json();
    setThreads(data.threads || []);
    if (data.threads?.length > 0) setSelected(data.threads[0]);
    setLoading(false);
  }

  function pickFile(file: File | null | undefined) {
    if (!file) return;
    setAttachedFile(file);
    if (file.type.startsWith("image/")) setAttachPreview(URL.createObjectURL(file));
    else setAttachPreview(null);
  }
  function clearAttachment() {
    if (attachPreview) URL.revokeObjectURL(attachPreview);
    setAttachedFile(null); setAttachPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadAttachment(): Promise<{ ref: string; name: string; type: string } | null> {
    if (!attachedFile) return null;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", attachedFile);
      const res = await fetch("/api/student/messages/upload-attachment", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return { ref: data.ref, name: data.name, type: data.type };
    } finally {
      setUploading(false);
    }
  }

  async function startThread() {
    if (!profile || !newText.trim()) return;
    setSending(true); setBotTyping(true);
    try {
      const attachment = await uploadAttachment();
      const res = await fetch("/api/student/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: profile.email, name: profile.name,
          subject: newSubject.trim() || "General question", text: newText.trim(),
          attachmentRef: attachment?.ref, attachmentName: attachment?.name, attachmentType: attachment?.type,
        }),
      });
      const data = await res.json();
      setThreads(t => [data.thread, ...t]);
      setSelected(data.thread);
      setComposing(false); setNewSubject(""); setNewText(""); clearAttachment();
    } finally { setSending(false); setBotTyping(false); }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const willBotReply = !selected.adminHasReplied;
    if (willBotReply) setBotTyping(true);
    try {
      const attachment = await uploadAttachment();
      const res = await fetch(`/api/student/messages/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: reply.trim(),
          attachmentRef: attachment?.ref, attachmentName: attachment?.name, attachmentType: attachment?.type,
        }),
      });
      const data = await res.json();
      setSelected(data.thread);
      setThreads(ts => ts.map(t => t.id === data.thread.id ? data.thread : t));
      setReply(""); clearAttachment();
    } finally { setSending(false); setBotTyping(false); }
  }

  if (!profile) return null;

  return (
    <div>
      <PageHeader eyebrow="Support" title="Messages" subtitle="Live chat with AI Guru's support — a bot answers instantly, and a real person jumps in when needed." />

      {!composing && (
        <div className="mb-5">
          <button onClick={() => setComposing(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-board hover:bg-marigolddim transition-colors">
            <Plus size={14} /> New conversation
          </button>
        </div>
      )}

      {composing && (
        <Card className="mb-5">
          <div className="mb-3 font-display text-base text-chalk">Start a new conversation</div>
          <input
            className="mb-3 w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
            placeholder="Subject (e.g. Payment issue, App not loading…)"
            value={newSubject} onChange={e => setNewSubject(e.target.value)} />
          <textarea
            className="mb-3 w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
            rows={3} placeholder="Describe your question or problem…"
            value={newText} onChange={e => setNewText(e.target.value)} />
          <AttachmentPicker file={attachedFile} preview={attachPreview} onPick={pickFile} onClear={clearAttachment} inputRef={fileInputRef} />
          <div className="mt-3 flex gap-2">
            <button onClick={startThread} disabled={!newText.trim() || sending || uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-board hover:bg-marigolddim disabled:opacity-50">
              {sending || uploading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
            </button>
            <button onClick={() => { setComposing(false); clearAttachment(); }}
              className="rounded-lg border border-board3 px-4 py-2 text-sm text-chalkdim hover:text-chalk">
              Cancel
            </button>
          </div>
        </Card>
      )}

      {loading && <div className="flex items-center gap-2 py-8 text-sm text-chalkdim"><Loader2 size={16} className="animate-spin" /> Loading…</div>}

      {!loading && threads.length === 0 && !composing && (
        <EmptyState text="No conversations yet — click New conversation if you have a question or problem." />
      )}

      {!loading && threads.length > 0 && (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
            {threads.map(t => (
              <button key={t.id} onClick={() => setSelected(t)}
                className={`shrink-0 text-left rounded-lg border px-3.5 py-2.5 transition-colors ${
                  selected?.id === t.id ? "border-marigold bg-marigold/10" : "border-board3 bg-board2 hover:border-marigold/40"
                }`}>
                <div className="text-sm text-chalk truncate max-w-[160px]">{t.subject}</div>
                <span className={`font-mono text-[9px] ${t.status === "open" ? "text-terracotta" : "text-marigold"}`}>{t.status}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="rounded-2xl border border-board3 bg-board2 flex flex-col overflow-hidden" style={{ height: 520 }}>
              {/* Chat header */}
              <div className="flex items-center gap-2 border-b border-board3 px-4 py-3 shrink-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-marigold/15">
                  <Headset size={14} className="text-marigold" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-chalk truncate">{selected.subject}</div>
                  <div className="font-mono text-[9px] text-chalkdim">
                    {selected.adminHasReplied ? "Talking with the support team" : "Guru Bot · instant replies"}
                  </div>
                </div>
              </div>

              {/* Message stream */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                {selected.messages.map(m => (
                  <div key={m.id} className={`flex flex-col ${m.from === "student" ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      m.from === "student"
                        ? "bg-blue text-board rounded-br-sm"
                        : m.from === "bot"
                        ? "bg-board3 text-chalk rounded-bl-sm"
                        : "bg-marigold/15 border border-marigold/30 text-chalk rounded-bl-sm"
                    }`}>
                      <div className="mb-1 flex items-center gap-1 font-mono text-[9px] opacity-70">
                        <SenderIcon from={m.from} /> {senderLabel(m.from)}
                      </div>
                      {m.attachmentUrl && (
                        m.attachmentType?.startsWith("image/") ? (
                          <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer">
                            <img src={m.attachmentUrl} alt={m.attachmentName || "attachment"}
                              className="mb-2 max-h-40 rounded-lg border border-board3 object-cover" />
                          </a>
                        ) : (
                          <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer"
                            className="mb-2 flex items-center gap-1.5 rounded-lg border border-board3 bg-board px-2.5 py-1.5 text-xs hover:border-marigold/50">
                            <FileText size={12} /> {m.attachmentName || "Attachment"}
                          </a>
                        )
                      )}
                      {m.text}
                    </div>
                    <span className="mt-1 font-mono text-[9px] text-chalkdim">{timeLabel(m.sentAt)}</span>
                  </div>
                ))}

                {botTyping && (
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
                  <div className="mb-2">
                    <AttachmentPicker file={attachedFile} preview={attachPreview} onPick={pickFile} onClear={clearAttachment} inputRef={fileInputRef} compact />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => fileInputRef.current?.click()}
                    title="Attach a screenshot or file"
                    className="shrink-0 rounded-lg border border-board3 p-2.5 text-chalkdim hover:text-chalk hover:border-marigold/50">
                    <Paperclip size={15} />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={e => pickFile(e.target.files?.[0])} />
                  <input
                    className="flex-1 rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
                    placeholder="Type a message…"
                    value={reply} onChange={e => setReply(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendReply()} />
                  <button onClick={sendReply} disabled={(!reply.trim() && !attachedFile) || sending || uploading}
                    className="shrink-0 rounded-lg bg-marigold p-2.5 text-board hover:bg-marigolddim disabled:opacity-50">
                    {sending || uploading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AttachmentPicker({
  file, preview, onPick, onClear, inputRef, compact,
}: {
  file: File | null; preview: string | null;
  onPick: (f: File | null | undefined) => void; onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement>; compact?: boolean;
}) {
  if (!file) {
    if (compact) return null;
    return (
      <button type="button" onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-board3 px-3 py-2 text-xs text-chalkdim hover:text-chalk hover:border-marigold/50">
        <Paperclip size={12} /> Attach a screenshot or file (optional)
        <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={e => onPick(e.target.files?.[0])} />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-board3 bg-board px-2.5 py-1.5">
      {preview ? (
        <img src={preview} alt="attachment preview" className="h-8 w-8 rounded object-cover" />
      ) : (
        <FileText size={14} className="text-chalkdim" />
      )}
      <span className="flex-1 truncate text-xs text-chalk">{file.name}</span>
      <button onClick={onClear} className="text-chalkdim hover:text-terracotta"><X size={13} /></button>
    </div>
  );
}
