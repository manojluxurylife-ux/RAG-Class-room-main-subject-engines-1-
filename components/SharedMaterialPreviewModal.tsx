"use client";
/**
 * SharedMaterialPreviewModal — shows the first few pages of a shared
 * (admin-pool) material's source PDF, so a student can visually
 * confirm "yes, this is really my textbook/syllabus" before adding it,
 * instead of trusting a title match alone.
 *
 * Reuses the download route's existing ?preview=1 mode (see
 * app/api/student/materials/[id]/download/route.ts — that mode already
 * existed, proxied instead of redirected specifically so pdf.js can
 * read the bytes without hitting a cross-origin issue on a redirected
 * signed URL) and the same pdfjs-dist rendering approach already used
 * in components/PDFPagePicker.tsx, just pointed at a fetched Response
 * instead of an in-hand File.
 *
 * Only PDF-backed materials (source "gcs" or "vps") are genuinely
 * previewable this way — "drive" and "generated" materials fall back
 * to whatever preview thumbnail the material already carries
 * (textbookPreviewUrl), or a plain notice if there isn't one, rather
 * than trying to feed non-PDF bytes into pdf.js.
 */
import { useEffect, useRef, useState } from "react";
import { X, Loader2, ChevronLeft, ChevronRight, BookOpen, Download } from "lucide-react";

const MAX_PREVIEW_PAGES = 4;
const RENDER_SCALE = 1.1;

interface Props {
  material: { id: string; title: string; source: string; textbookPreviewUrl?: string };
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirming?: boolean;
}

export function SharedMaterialPreviewModal({ material, onClose, onConfirm, confirmLabel = "Yes, this is my textbook — add it", confirming }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "unsupported">("loading");
  const [pages, setPages] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const cancelledRef = useRef(false);

  const canRenderPdf = material.source === "gcs" || material.source === "vps";

  useEffect(() => {
    cancelledRef.current = false;
    if (!canRenderPdf) { setStatus("unsupported"); return; }

    (async () => {
      try {
        const res = await fetch(`/api/student/materials/${material.id}/download?preview=1`);
        if (!res.ok) throw new Error("Preview unavailable.");
        const arrayBuffer = await res.arrayBuffer();
        if (cancelledRef.current) return;

        // Same worker-loading approach as PDFPagePicker.tsx — a plain
        // /public static file, not a webpack asset or CDN URL (both
        // broke in production for reasons documented there).
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelledRef.current) return;

        setTotalPages(pdf.numPages);
        const pageCount = Math.min(pdf.numPages, MAX_PREVIEW_PAGES);
        const rendered: string[] = [];
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
          rendered.push(canvas.toDataURL("image/jpeg", 0.85));
          if (cancelledRef.current) return;
        }
        setPages(rendered);
        setStatus("ready");
      } catch {
        if (!cancelledRef.current) setStatus("error");
      }
    })();

    return () => { cancelledRef.current = true; };
  }, [material.id, canRenderPdf]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-board3 bg-board p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-marigold">Confirm before adding</div>
            <div className="truncate font-display text-base text-chalk">{material.title}</div>
          </div>
          <button onClick={onClose} className="shrink-0 p-1 text-chalkdim hover:text-terracotta transition-colors"><X size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {status === "loading" && (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-board3 bg-board2 p-10 text-chalkdim">
              <Loader2 size={20} className="animate-spin" />
              <span className="font-mono text-xs">Loading pages…</span>
            </div>
          )}

          {status === "error" && (
            <div className="rounded-xl border border-board3 bg-board2 p-6 text-center text-sm text-terracotta">
              Couldn't load a preview for this material right now. You can still add it and check once it's downloaded.
            </div>
          )}

          {status === "unsupported" && (
            material.textbookPreviewUrl ? (
              <img src={material.textbookPreviewUrl} alt="Textbook page" className="mx-auto max-h-96 rounded-lg border border-board3 object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-board3 bg-board2 p-8 text-center text-sm text-chalkdim">
                <BookOpen size={20} />
                A page-by-page preview isn't available for this material — you can still add it and check once it's downloaded.
              </div>
            )
          )}

          {status === "ready" && pages[current] && (
            <div>
              <img src={pages[current]} alt={`Page ${current + 1}`} className="mx-auto max-h-[55vh] rounded-lg border border-board3 object-contain bg-white" />
              <div className="mt-2 flex items-center justify-center gap-3">
                <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
                  className="disabled:opacity-30 text-chalkdim hover:text-chalk"><ChevronLeft size={16} /></button>
                <span className="font-mono text-[10px] text-chalkdim">
                  Page {current + 1} of {pages.length}{totalPages > pages.length ? ` (of ${totalPages} total)` : ""}
                </span>
                <button onClick={() => setCurrent(c => Math.min(pages.length - 1, c + 1))} disabled={current === pages.length - 1}
                  className="disabled:opacity-30 text-chalkdim hover:text-chalk"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>

        <button onClick={onConfirm} disabled={confirming}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-board hover:bg-marigolddim disabled:opacity-50 transition-colors">
          {confirming ? <><Loader2 size={14} className="animate-spin" /> Adding…</> : <><Download size={14} /> {confirmLabel}</>}
        </button>
      </div>
    </div>
  );
}
