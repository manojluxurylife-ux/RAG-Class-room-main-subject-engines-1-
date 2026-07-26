"use client";
/**
 * Admin's side of the live chat — same chat window as the student's
 * view, so admin sees exactly the conversation the student had,
 * including anything the bot already said and any screenshots attached.
 * Replying here sets adminHasReplied (see lib/messages-store.ts), which
 * silences the bot for this thread from then on — a human is handling
 * it now.
 */
import { useEffect, useRef, useState } from "react";
import {
  Loader2, Send, CheckCircle, RotateCcw, FileText, Bot, User, Headset,
} from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui";

interface ThreadMessage {
  id: string; from: "student" | "admin" | "bot"; text: string; sentAt: string;
  attachmentUrl?: string; attachmentName?: string; attachmentType?: string;
}
interface Thread {
  id: string; studentName: string; studentEmail: string; subject: string;
  status: "open" | "resolved"; messages: ThreadMessage[]; updatedAt: string;
  adminHasReplied: boolean;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
function SenderIcon({ from }: { from: ThreadMessage["from"] }) {
  if (from === "student") return <User size={11} />;
  if (from === "bot")     return <Bot size={11} />;
  return <Headset size={11} />;
}

export default function AdminMessagesPage() {
  const [threads,  setThreads]  = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [reply,     setReply]   = useState("");
  const [loading,   setLoading] = useState(true);
  const [sending,   setSending] = useState(false);
  const [filter,    setFilter]  = useState<"all" | "open" | "resolved">("open");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [selected?.messages.length]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/messages");
    const data = await res.json();
    setThreads(data.threads || []);
    if (data.threads?.length > 0 && !selected) setSelected(data.threads[0]);
    setLoading(false);
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/messages/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply.trim() }),
      });
      const data = await res.json();
      setSelected(data.thread);
      setThreads(ts => ts.map(t => t.id === data.thread.id ? data.thread : t));
      setReply("");
    } finally { setSending(false); }
  }

  async function toggleStatus() {
    if (!selected) return;
    const newStatus = selected.status === "open" ? "resolved" : "open";
    const res = await fetch(`/api/admin/messages/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    setSelected(data.thread);
    setThreads(ts => ts.map(t => t.id === data.thread.id ? data.thread : t));
  }

  const visible = threads.filter(t => filter === "all" || t.status === filter);

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Messages" subtitle="Live chat with students — a bot answers first, you take over whenever you want." />

      <div className="mb-4 flex gap-2">
        {(["open", "resolved", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-mono capitalize ${
              filter === f ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
            }`}>
            {f} {f !== "all" && `(${threads.filter(t => t.status === f).length})`}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center gap-2 py-10 text-sm text-chalkdim"><Loader2 size={16} className="animate-spin" /> Loading…</div>}

      {!loading && visible.length === 0 && <EmptyState text="No messages here." />}

      {!loading && visible.length > 0 && (
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          {/* Thread list */}
          <div className="flex flex-col gap-2 max-h-[560px] overflow-y-auto">
            {visible.map(t => (
              <button key={t.id} onClick={() => setSelected(t)}
                className={`text-left rounded-lg border px-3.5 py-2.5 transition-colors ${
                  selected?.id === t.id ? "border-marigold bg-marigold/10" : "border-board3 bg-board2 hover:border-marigold/40"
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-chalk truncate">{t.studentName}</div>
                  {!t.adminHasReplied && (
                    <span title="Bot is currently handling this" className="shrink-0 text-marigold"><Bot size={11} /></span>
                  )}
                </div>
                <div className="text-xs text-chalkdim truncate">{t.subject}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`font-mono text-[9px] ${t.status === "open" ? "text-terracotta" : "text-marigold"}`}>{t.status}</span>
                  <span className="font-mono text-[9px] text-chalkdim">{new Date(t.updatedAt).toLocaleDateString("en-IN")}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Thread detail — same chat window shape as the student's own view */}
          {selected && (
            <div className="rounded-2xl border border-board3 bg-board2 flex flex-col overflow-hidden" style={{ height: 560 }}>
              <div className="flex items-center justify-between border-b border-board3 px-4 py-3 shrink-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-chalk truncate">{selected.subject}</div>
                  <div className="font-mono text-[9px] text-chalkdim truncate">{selected.studentName} · {selected.studentEmail}</div>
                </div>
                <button onClick={toggleStatus}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-board3 px-3 py-1.5 text-xs text-chalkdim hover:text-chalk hover:border-marigold/50">
                  {selected.status === "open" ? <><CheckCircle size={12} /> Mark resolved</> : <><RotateCcw size={12} /> Reopen</>}
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                {selected.messages.map(m => (
                  <div key={m.id} className={`flex flex-col ${m.from === "admin" ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      m.from === "admin"
                        ? "bg-marigold text-board rounded-br-sm"
                        : m.from === "bot"
                        ? "bg-board3 text-chalk rounded-bl-sm"
                        : "bg-blue/15 border border-blue/30 text-chalk rounded-bl-sm"
                    }`}>
                      <div className="mb-1 flex items-center gap-1 font-mono text-[9px] opacity-70">
                        <SenderIcon from={m.from} /> {m.from === "admin" ? "You" : m.from === "bot" ? "Guru Bot" : selected.studentName}
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
              </div>

              <div className="border-t border-board3 p-3 shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
                    placeholder="Type a reply — this takes over from the bot for this conversation…"
                    value={reply} onChange={e => setReply(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendReply()} />
                  <button onClick={sendReply} disabled={!reply.trim() || sending}
                    className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-board hover:bg-marigolddim disabled:opacity-50">
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
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
