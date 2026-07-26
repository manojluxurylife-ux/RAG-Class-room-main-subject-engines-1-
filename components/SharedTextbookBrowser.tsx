"use client";
/**
 * SharedTextbookBrowser — "check what other students already made,
 * BEFORE you go searching the web."
 *
 * Shown as step 1 inside Student Settings → Download your textbook.
 * A drop-down list of the pre-made textbooks (PDFs) and study materials
 * already published for this student's board + class + medium — one
 * student uploads, the whole class benefits, and most students never
 * need the web search at all (which is the entire cost-sharing idea of
 * this app).
 *
 * Confirmation-first: tapping an item does NOT download it. For a PDF
 * it fetches the file once in preview mode (?preview=1 — proxied
 * same-origin, not logged as a download) and renders the FIRST THREE
 * PAGES as thumbnails, so the student can see the actual cover and
 * opening pages and confirm "yes, this is really my book" before the
 * real download. For a shared kitchen material it shows the stored
 * photograph of the textbook page it was made from — same idea, same
 * reason: confirm by looking, don't trust a title match.
 */
import { useEffect, useState } from "react";
import {
  BookOpen, ChevronDown, ChevronUp, Download, Loader2, Sparkles, CheckCircle2, FileText,
} from "lucide-react";
import { renderPdfPagesToDataUrls } from "@/lib/client/pdf-page";

interface SharedItem {
  id: string;
  title: string;
  subject: string;
  fileType: string;
  sizeBytes: number;
  source: string;
  sourceStudyMaterialId?: string;
  textbookPreviewUrl?: string;
}

interface Props {
  board: string;
  grade: string;
  languageId: string;
  email: string;
  name?: string;
}

function fmtSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SharedTextbookBrowser({ board, grade, languageId, email, name }: Props) {
  const [open,    setOpen]    = useState(true); // open by default — it IS the first step
  const [loading, setLoading] = useState(true);
  const [items,   setItems]   = useState<SharedItem[]>([]);

  // Per-item preview state
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [previewing,  setPreviewing]  = useState(false);
  const [pagePreviews, setPagePreviews] = useState<{ page: number; dataUrl: string }[]>([]);
  const [previewErr,  setPreviewErr]  = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedId,  setImportedId]  = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ board, grade });
    if (languageId) params.set("language", languageId);
    fetch(`/api/student/materials?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        // Only things that make sense as "a textbook / study material I
        // could use instead of searching the web": whole PDFs, and
        // student-shared kitchen materials (they carry an import path
        // and/or a textbook-page photo).
        const all: SharedItem[] = d.materials || [];
        setItems(all.filter(m =>
          m.fileType === "pdf" || m.sourceStudyMaterialId || m.textbookPreviewUrl,
        ));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function downloadUrl(id: string, preview = false) {
    const p = new URLSearchParams({ studentId: email, email });
    if (name) p.set("name", name);
    if (preview) p.set("preview", "1");
    return `/api/student/materials/${id}/download?${p.toString()}`;
  }

  /** Expand an item and, for a PDF, render its first three pages. */
  async function toggleItem(m: SharedItem) {
    if (expandedId === m.id) { setExpandedId(null); return; }
    setExpandedId(m.id);
    setPagePreviews([]); setPreviewErr("");
    if (m.fileType !== "pdf") return; // kitchen material — image preview renders directly

    setPreviewing(true);
    try {
      const res = await fetch(downloadUrl(m.id, true));
      if (!res.ok) throw new Error();
      const buf = await res.arrayBuffer();
      const thumbs = await renderPdfPagesToDataUrls(buf, [1, 2, 3]);
      setPagePreviews(thumbs);
      if (thumbs.length === 0) throw new Error();
    } catch {
      setPreviewErr("Couldn't preview the pages — you can still open the file to check it.");
    } finally {
      setPreviewing(false);
    }
  }

  /** Shared kitchen material → copy into this student's own Classroom. */
  async function importMaterial(m: SharedItem) {
    setImportingId(m.id);
    try {
      const res = await fetch("/api/student/study-materials/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: m.id, studentId: email }),
      });
      if (res.ok) setImportedId(m.id);
    } finally {
      setImportingId(null);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-leaf/40 bg-leaf/5">
      {/* The drop-down header */}
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2 p-3 text-left">
        <BookOpen size={14} className="shrink-0 text-leaf" />
        <span className="text-sm text-chalk">
          <b className="text-leaf">Step 1:</b> check what other students already shared
          {!loading && ` (${items.length})`}
        </span>
        <span className="ml-auto text-chalkdim">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-leaf/20 p-3">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-chalkdim">
              <Loader2 size={13} className="animate-spin" /> Checking your class shelf…
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-chalkdim">
              Nothing shared for Class {grade} yet — you'll be the first! Search the web below,
              and once you upload your textbook, your classmates will find it here.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-chalkdim">
                Tap a book to see its first pages and confirm it's really yours before downloading.
              </p>
              {items.map(m => (
                <div key={m.id} className="rounded-lg border border-board3 bg-board2">
                  <button onClick={() => toggleItem(m)} className="flex w-full items-center gap-2.5 p-2.5 text-left">
                    {m.fileType === "pdf"
                      ? <FileText size={14} className="shrink-0 text-marigold" />
                      : <Sparkles size={14} className="shrink-0 text-marigold" />}
                    <span className="min-w-0 flex-1 truncate text-sm text-chalk">{m.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-chalkdim">
                      {m.subject}{m.sizeBytes ? ` · ${fmtSize(m.sizeBytes)}` : ""}
                    </span>
                    <span className="shrink-0 text-chalkdim">
                      {expandedId === m.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  </button>

                  {expandedId === m.id && (
                    <div className="border-t border-board3 p-2.5">
                      {/* ── Confirm-by-looking: first pages ── */}
                      {m.fileType === "pdf" ? (
                        previewing ? (
                          <div className="flex items-center gap-2 py-3 text-xs text-chalkdim">
                            <Loader2 size={13} className="animate-spin text-marigold" />
                            Opening the first pages…
                          </div>
                        ) : pagePreviews.length > 0 ? (
                          <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1">
                            {pagePreviews.map(p => (
                              <div key={p.page} className="shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.dataUrl} alt={`Page ${p.page}`}
                                  className="h-40 rounded-md border border-board3 bg-white object-contain" />
                                <div className="mt-1 text-center font-mono text-[10px] text-chalkdim">p.{p.page}</div>
                              </div>
                            ))}
                          </div>
                        ) : previewErr ? (
                          <div className="mb-2.5 text-xs text-terracotta">{previewErr}</div>
                        ) : null
                      ) : m.textbookPreviewUrl ? (
                        <div className="mb-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.textbookPreviewUrl} alt="The textbook page this was made from"
                            className="h-40 rounded-md border border-board3 object-contain" />
                          <div className="mt-1 font-mono text-[10px] text-chalkdim">
                            Made from this textbook page — is it yours?
                          </div>
                        </div>
                      ) : (
                        <div className="mb-2.5 text-xs text-chalkdim">No page preview stored for this one.</div>
                      )}

                      {/* ── Actions once confirmed ── */}
                      <div className="flex flex-wrap items-center gap-2">
                        {m.fileType === "pdf" && (
                          <a href={downloadUrl(m.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-marigold px-3 py-1.5 font-mono text-[10px] font-semibold text-board hover:bg-marigolddim transition-colors">
                            <Download size={11} /> Yes, this is my book — download
                          </a>
                        )}
                        {m.sourceStudyMaterialId && (
                          importedId === m.id ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-leaf">
                              <CheckCircle2 size={12} /> Added to your Classroom
                            </span>
                          ) : (
                            <button onClick={() => importMaterial(m)} disabled={importingId === m.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-marigold/40 bg-marigold/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-marigold hover:bg-marigold/20 disabled:opacity-50 transition-colors">
                              {importingId === m.id
                                ? <Loader2 size={11} className="animate-spin" />
                                : "Add to my Classroom"}
                            </button>
                          )
                        )}
                        {m.fileType === "pdf" && (
                          <span className="font-mono text-[10px] text-chalkdim">
                            then add it on the <a href="/study-materials" className="text-marigold underline underline-offset-2">Study Materials</a> page
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
