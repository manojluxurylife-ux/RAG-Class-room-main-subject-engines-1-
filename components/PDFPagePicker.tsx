"use client";
/**
 * PDFPagePicker
 * Renders all pages of a PDF as thumbnail canvases using pdfjs-dist (browser only).
 * The user taps a thumbnail; we rasterise that page at full resolution and call
 * onPageSelected with the resulting Blob (JPEG) + zero-based page number.
 *
 * Architecture note: all work happens client-side, so no server round-trip is
 * needed for previewing. We only hit /api/textbook once the user confirms a page.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";

interface Props {
  file: File;
  onPageSelected: (blob: Blob, pageNumber: number, totalPages: number) => void;
  onCancel: () => void;
}

const THUMB_SCALE  = 0.4;   // thumbnail render scale
const EXPORT_SCALE = 2.0;   // full-res export scale for Claude vision

export function PDFPagePicker({ file, onPageSelected, onCancel }: Props) {
  const [status,     setStatus]     = useState<"loading" | "ready" | "exporting">("loading");
  const [totalPages, setTotalPages] = useState(0);
  const [thumbs,     setThumbs]     = useState<string[]>([]);   // dataURLs for display
  const [selected,   setSelected]   = useState(0);
  const [error,      setError]      = useState("");
  const pdfRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Dynamic import keeps the heavy pdfjs bundle out of the initial JS chunk
        const pdfjsLib = await import("pdfjs-dist");

        // Worker is served as a plain static file from /public — NOT via
        // webpack's asset pipeline (new URL(..., import.meta.url)), and
        // NOT from a CDN. Both were tried and both broke in real
        // deployment: the CDN URL 404s because cdnjs doesn't mirror every
        // pdfjs-dist version; the webpack-asset approach built fine in dev
        // but failed Next.js's production build entirely — Terser tried to
        // minify the emitted .mjs file and choked on `import.meta`, a
        // known incompatibility for ES-module worker files run through a
        // generic bundler asset pipeline. A plain /public file sidesteps
        // both problems: no external network dependency, no webpack/Terser
        // processing at all. Kept in sync automatically by the
        // "postinstall" script in package.json — see there if this ever
        // needs to be regenerated after a pdfjs-dist version bump.
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;

        pdfRef.current = pdf;
        setTotalPages(pdf.numPages);

        // Render all page thumbnails in parallel (capped at 20 for safety)
        const pageCount = Math.min(pdf.numPages, 20);
        const thumbList: string[] = [];

        for (let i = 1; i <= pageCount; i++) {
          const page     = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: THUMB_SCALE });
          const canvas   = document.createElement("canvas");
          canvas.width   = viewport.width;
          canvas.height  = viewport.height;
          await page.render({ canvas, viewport }).promise;
          thumbList.push(canvas.toDataURL("image/jpeg", 0.7));
          if (cancelled) return;
        }

        setThumbs(thumbList);
        setStatus("ready");
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not read this PDF.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [file]);

  async function exportPage(pageIdx: number) {
    if (!pdfRef.current) return;
    setStatus("exporting");
    try {
      const pdfjsLib = await import("pdfjs-dist");
      const page     = await pdfRef.current.getPage(pageIdx + 1);
      const viewport = page.getViewport({ scale: EXPORT_SCALE });
      const canvas   = document.createElement("canvas");
      canvas.width   = viewport.width;
      canvas.height  = viewport.height;
      await page.render({ canvas, viewport }).promise;
      canvas.toBlob(
        (blob) => {
          if (blob) onPageSelected(blob, pageIdx + 1, totalPages);
          else setError("Could not export this page.");
        },
        "image/jpeg",
        0.92,
      );
    } catch (e: any) {
      setError(e?.message || "Could not export this page.");
      setStatus("ready");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="rounded-xl border border-board3 bg-board2 p-6 text-center">
        <p className="mb-3 text-sm text-terracotta">{error}</p>
        <button onClick={onCancel} className="text-xs text-chalkdim hover:text-chalk">
          ← Try a different file
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-board3 bg-board2 p-10 text-chalkdim">
        <Loader2 size={20} className="animate-spin" />
        <span className="font-mono text-xs">Rendering pages…</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-board3 bg-board2 p-4">

      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-marigold">
            {file.name}
          </div>
          <div className="mt-0.5 text-xs text-chalkdim">
            {totalPages} page{totalPages !== 1 ? "s" : ""} — tap a page to teach from it
            {totalPages > 20 && " (showing first 20)"}
          </div>
        </div>
        <button onClick={onCancel} className="text-xs text-chalkdim hover:text-chalk">
          ✕ Change file
        </button>
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 mb-4 max-h-72 overflow-y-auto pr-1">
        {thumbs.map((src, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
              selected === i
                ? "border-marigold shadow-[0_0_0_3px_rgba(232,163,61,0.3)]"
                : "border-board3 hover:border-marigold/50"
            }`}
          >
            <img src={src} alt={`Page ${i + 1}`} className="w-full block" />
            <div className={`absolute bottom-0 left-0 right-0 py-0.5 text-center font-mono text-[9px] transition-colors ${
              selected === i ? "bg-marigold text-board" : "bg-board/80 text-chalkdim"
            }`}>
              p.{i + 1}
            </div>
          </button>
        ))}
      </div>

      {/* Selected page large preview */}
      {thumbs[selected] && (
        <div className="mb-4 overflow-hidden rounded-lg border border-board3">
          <img src={thumbs[selected]} alt={`Page ${selected + 1} preview`}
            className="w-full max-h-60 object-contain block bg-board" />
          <div className="border-t border-board3 px-3 py-1.5 flex items-center justify-between">
            <div className="font-mono text-[10px] text-chalkdim">Page {selected + 1} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected(s => Math.max(0, s - 1))}
                disabled={selected === 0}
                className="disabled:opacity-30 text-chalkdim hover:text-chalk">
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setSelected(s => Math.min(thumbs.length - 1, s + 1))}
                disabled={selected === thumbs.length - 1}
                className="disabled:opacity-30 text-chalkdim hover:text-chalk">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={() => exportPage(selected)}
        disabled={status === "exporting"}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-board disabled:opacity-50 hover:bg-marigolddim transition-colors"
      >
        {status === "exporting"
          ? <><Loader2 size={14} className="animate-spin" /> Preparing page…</>
          : <><BookOpen size={14} /> Teach from page {selected + 1}</>
        }
      </button>
    </div>
  );
}
