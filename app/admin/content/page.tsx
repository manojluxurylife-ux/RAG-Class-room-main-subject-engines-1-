"use client";
import { useEffect, useState } from "react";
import { Card, PageHeader, Button, EmptyState } from "@/components/ui";
import {
  FolderOpen, Cloud, HardDrive, BookOpen, Trash2, Eye, EyeOff, Loader2,
  CheckCircle, ChevronRight, Download
} from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

const SOURCES   = [
  { id: "drive", label: "Google Drive",   icon: FolderOpen, color: "#4285F4" },
  { id: "gcs",   label: "Cloud Storage",  icon: Cloud,      color: "#EA4335" },
  { id: "vps",   label: "VPS / Local",    icon: HardDrive,  color: "#e8a33d" },
] as const;

const SUBJECTS  = ["Maths","Science","Social Studies","Language","General"];
const ALL_BOARDS = [
  { id: "cbse",      label: "CBSE (NCERT)" },
  { id: "kerala",    label: "Kerala SCERT" },
  { id: "tamilnadu", label: "Tamil Nadu"   },
  { id: "karnataka", label: "Karnataka"    },
];
const ALL_GRADES = ["6","7","8","9","10"];

type SourceId = "drive" | "gcs" | "vps";

interface RemoteFile {
  id?:      string;   // Drive only
  name:     string;
  fileType: string;
  size?:    number;
  modified?:string;
  isFolder?:boolean;
}

interface PublishedMaterial {
  id:       string;
  title:    string;
  subject:  string;
  boards:   string[];
  grades:   string[];
  languages:string[];
  fileType: string;
  source:   string;
  published:boolean;
  sizeBytes:number;
}

const CONTENT_LANGUAGES = SUPPORTED_LANGUAGES.map(l => ({ id: l.id, label: l.label }));

export default function AdminContentPage() {
  const [activeSource,  setActiveSource]  = useState<SourceId>("drive");
  const [remoteFiles,   setRemoteFiles]   = useState<RemoteFile[]>([]);
  const [loadingFiles,  setLoadingFiles]  = useState(false);
  const [fileError,     setFileError]     = useState("");
  const [published,     setPublished]     = useState<PublishedMaterial[]>([]);
  const [loadingPub,    setLoadingPub]    = useState(true);

  // Publish form
  const [selected,      setSelected]      = useState<RemoteFile | null>(null);
  const [form,          setForm]          = useState({
    title: "", subject: "Maths", boards: [] as string[], grades: [] as string[], languages: [] as string[],
  });
  const [publishing,    setPublishing]    = useState(false);
  const [publishOk,     setPublishOk]     = useState(false);

  // ── Load published list ──
  useEffect(() => {
    fetch("/api/admin/materials")
      .then(r => r.json())
      .then(d => setPublished(d.materials || []))
      .finally(() => setLoadingPub(false));
  }, []);

  // ── Browse remote source ──
  async function browseSource(src: SourceId) {
    setActiveSource(src); setRemoteFiles([]); setFileError(""); setSelected(null);
    setLoadingFiles(true);
    try {
      const endpoint = src === "drive" ? "/api/admin/drive"
        : src === "gcs" ? "/api/admin/gcs" : "/api/admin/vps";
      const res  = await fetch(endpoint);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load files");
      setRemoteFiles((data.files || []).filter((f: RemoteFile) => !f.isFolder));
    } catch (e: any) {
      setFileError(e.message);
    } finally {
      setLoadingFiles(false);
    }
  }

  function selectFile(file: RemoteFile) {
    setSelected(file);
    setForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, "") }));
    setPublishOk(false);
  }

  function toggleBoard(id: string) {
    setForm(f => ({
      ...f, boards: f.boards.includes(id) ? f.boards.filter(b => b !== id) : [...f.boards, id],
    }));
  }

  function toggleGrade(g: string) {
    setForm(f => ({
      ...f, grades: f.grades.includes(g) ? f.grades.filter(x => x !== g) : [...f.grades, g],
    }));
  }

  function toggleContentLanguage(id: string) {
    setForm(f => ({
      ...f, languages: f.languages.includes(id) ? f.languages.filter(x => x !== id) : [...f.languages, id],
    }));
  }

  async function publish() {
    if (!selected || !form.title) return;
    setPublishing(true);
    try {
      const sourceRef = activeSource === "drive" ? (selected.id || selected.name) : selected.name;
      const res = await fetch("/api/admin/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:    form.title,
          subject:  form.subject,
          boards:   form.boards,
          grades:   form.grades,
          languages:form.languages,
          fileType: selected.fileType || "pdf",
          source:   activeSource,
          sourceRef,
          sizeBytes: selected.size || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPublished(p => [data.material, ...p]);
      setSelected(null); setPublishOk(true);
    } catch (e: any) {
      setFileError(e.message);
    } finally {
      setPublishing(false);
    }
  }

  async function togglePublish(id: string, published: boolean) {
    await fetch("/api/admin/materials", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, published: !published }),
    });
    setPublished(p => p.map(m => m.id === id ? { ...m, published: !published } : m));
  }

  async function remove(id: string) {
    if (!confirm("Remove this material from student view? (The original file is not deleted.)")) return;
    await fetch(`/api/admin/materials?id=${id}`, { method: "DELETE" });
    setPublished(p => p.filter(m => m.id !== id));
  }

  // ─────────────────────────────────── Render ───────────────────────────────

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Study Materials"
        subtitle="Browse your Google Drive, Cloud Storage, or VPS folder — tag and publish files for students to download."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

        {/* ── LEFT: Source browser + publish form ── */}
        <div>
          {/* Source tabs */}
          <div className="mb-4 flex gap-2 flex-wrap">
            {SOURCES.map(s => (
              <button key={s.id}
                onClick={() => browseSource(s.id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                  activeSource === s.id
                    ? "border-marigold bg-marigold text-board"
                    : "border-board3 bg-board2 text-chalkdim hover:text-chalk hover:border-marigold/50"
                }`}>
                <s.icon size={14} />
                {s.label}
              </button>
            ))}
          </div>

          {/* File list */}
          <Card className="mb-4">
            {loadingFiles && (
              <div className="flex items-center gap-2 py-6 text-chalkdim text-sm">
                <Loader2 size={16} className="animate-spin" /> Loading files…
              </div>
            )}
            {fileError && <div className="py-4 text-sm text-terracotta">{fileError}</div>}
            {!loadingFiles && !fileError && remoteFiles.length === 0 && (
              <EmptyState text={`Click a source tab above to browse files.`} />
            )}
            {remoteFiles.length > 0 && (
              <div className="flex flex-col divide-y divide-board3">
                {remoteFiles.map((f, i) => (
                  <button key={i} onClick={() => selectFile(f)}
                    className={`flex items-center gap-3 px-1 py-2.5 text-left hover:bg-board3 rounded transition-colors ${
                      selected?.name === f.name ? "bg-board3" : ""
                    }`}>
                    <BookOpen size={14} className="shrink-0 text-marigold" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-chalk truncate">{f.name}</div>
                      <div className="font-mono text-[10px] text-chalkdim mt-0.5">
                        {f.fileType.toUpperCase()}
                        {f.size ? ` · ${(f.size / 1024).toFixed(0)} KB` : ""}
                      </div>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-chalkdim" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Publish form — shown once a file is selected */}
          {selected && (
            <Card>
              <div className="mb-3 font-display text-lg text-chalk">Publish to students</div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">File</div>
              <div className="mb-4 rounded-lg border border-board3 bg-board px-3 py-2 text-sm text-chalk">
                {selected.name}
              </div>

              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Title shown to students</div>
              <input className="mb-4 w-full rounded-lg border border-board3 bg-board px-3 py-2 text-sm text-chalk"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Subject</div>
              <div className="mb-4 flex flex-wrap gap-2">
                {SUBJECTS.map(s => (
                  <button key={s}
                    onClick={() => setForm(f => ({ ...f, subject: s }))}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      form.subject === s ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Boards (empty = all boards)</div>
              <div className="mb-4 flex flex-wrap gap-2">
                {ALL_BOARDS.map(b => (
                  <button key={b.id}
                    onClick={() => toggleBoard(b.id)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      form.boards.includes(b.id) ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                    }`}>
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Classes (empty = all classes)</div>
              <div className="mb-5 flex flex-wrap gap-2">
                {ALL_GRADES.map(g => (
                  <button key={g}
                    onClick={() => toggleGrade(g)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      form.grades.includes(g) ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                    }`}>
                    Class {g}
                  </button>
                ))}
              </div>

              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">
                Medium / language (empty = all mediums)
              </div>
              <p className="mb-2 text-[10px] text-chalkdim">
                e.g. a Class VI Tamil-medium worksheet — select Tamil here so only Tamil-medium
                students in that class receive it, not the whole class.
              </p>
              <div className="mb-5 flex flex-wrap gap-2">
                {CONTENT_LANGUAGES.map(l => (
                  <button key={l.id}
                    onClick={() => toggleContentLanguage(l.id)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      form.languages.includes(l.id) ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                    }`}>
                    {l.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button disabled={!form.title || publishing} onClick={publish}>
                  {publishing ? <><Loader2 size={14} className="animate-spin" /> Publishing…</> : "Publish"}
                </Button>
                <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
              </div>

              {publishOk && (
                <div className="mt-3 flex items-center gap-2 text-sm text-marigold">
                  <CheckCircle size={14} /> Published — students can now download this material.
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ── RIGHT: Published materials list ── */}
        <div>
          <div className="font-display text-lg text-chalk mb-3">Published materials</div>
          {loadingPub && <div className="text-sm text-chalkdim">Loading…</div>}
          {!loadingPub && published.length === 0 && (
            <EmptyState text="No materials published yet. Browse a source and publish a file." />
          )}
          <div className="flex flex-col gap-2">
            {published.map(m => (
              <Card key={m.id} className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-chalk truncate font-medium">{m.title}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-chalkdim">
                      {m.subject} · {m.source.toUpperCase()} · {m.fileType.toUpperCase()}
                    </div>
                    {(m.boards.length > 0 || m.grades.length > 0) && (
                      <div className="mt-0.5 font-mono text-[10px] text-chalkdim">
                        {m.boards.length > 0 ? m.boards.join(", ") : "all boards"}
                        {" · "}
                        {m.grades.length > 0 ? m.grades.map(g => `Cl.${g}`).join(" ") : "all classes"}
                        {(m.languages?.length ?? 0) > 0 && <> · <span className="text-marigold">{m.languages.join(", ")}</span></>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => togglePublish(m.id, m.published)}
                      title={m.published ? "Unpublish" : "Publish"}
                      className="text-chalkdim hover:text-marigold">
                      {m.published ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button onClick={() => remove(m.id)}
                      title="Remove from student view"
                      className="text-chalkdim hover:text-terracotta">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {!m.published && (
                  <div className="mt-1 font-mono text-[10px] text-terracotta">Hidden from students</div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
