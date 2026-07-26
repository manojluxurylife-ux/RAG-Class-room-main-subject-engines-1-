"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { TextbookPageView } from "@/components/TextbookPageView";
import type { TextbookCue } from "@/lib/study-material-schema";

interface Props {
  url: string;
  mimeType?: string;
  cue?: TextbookCue;
}

export function TextbookTeachingView({ url, mimeType, cue }: Props) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const isPdf = useMemo(() => mimeType === "application/pdf" || /\.pdf(?:\?|$)/i.test(url), [mimeType, url]);

  useEffect(() => {
    if (!isPdf) { setPdfFile(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error("PDF unavailable"); return r.blob(); })
      .then(blob => { if (!cancelled) setPdfFile(new File([blob], "textbook.pdf", { type: "application/pdf" })); })
      .catch(() => { if (!cancelled) setPdfFile(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isPdf, url]);

  if (isPdf) {
    if (loading || !pdfFile) return <div className="flex min-h-64 items-center justify-center bg-white text-board"><Loader2 className="animate-spin" size={20} /></div>;
    return (
      <TextbookPageView
        file={pdfFile}
        pageNumber={cue?.page || 1}
        spotlight={cue?.quote}
        fallbackRegion={cue?.region}
        laserPointer
      />
    );
  }

  const region = cue?.region;
  const left = region?.x ?? 12;
  const top = region?.y ?? 12;
  const width = region?.width ?? 76;
  const height = region?.height ?? 18;
  return (
    <div className="relative overflow-hidden rounded-t-xl bg-white">
      <img src={url} alt="Textbook page" className="block w-full max-h-[520px] object-contain" />
      {cue && (
        <>
          <div
            className="pointer-events-none absolute rounded-md border-2 border-marigold transition-all duration-700 ease-out"
            style={{ left:`${left}%`, top:`${top}%`, width:`${width}%`, height:`${height}%`, boxShadow:"0 0 0 9999px rgba(10,16,12,.56), 0 0 28px rgba(232,163,61,.52)" }}
          />
          <div
            className="pointer-events-none absolute h-3.5 w-3.5 rounded-full bg-red-500 shadow-[0_0_4px_2px_rgba(239,68,68,.75),0_0_18px_8px_rgba(239,68,68,.35)] transition-all duration-700 ease-out"
            style={{ left:`calc(${left + Math.min(width * .82, width - 3)}% - 7px)`, top:`calc(${top + height / 2}% - 7px)` }}
            aria-label="AI laser pointer"
          />
        </>
      )}
    </div>
  );
}
