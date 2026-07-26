"use client";
/**
 * Admin tool: extract a draft ExamPattern directly from a real uploaded
 * sample paper PDF, instead of hand-researching blueprints from
 * secondary sources that can conflict with each other (exactly what
 * happened researching CBSE Science by hand). Adopted the idea from
 * evaluating DeepTutor's exam-mimic system (Apache 2.0).
 *
 * Deliberately NOT auto-published — this produces a reviewable draft
 * and a ready-to-paste TypeScript snippet. The admin adds it to
 * lib/exam-patterns.ts's EXAM_PATTERNS array by hand, after checking it
 * against the real document — same "reviewed, verified, never faked"
 * principle that file has stated from the start. Automatically flags
 * any section where the block marks don't sum to the declared total,
 * since that's a real, checkable signal the AI misread something.
 */
import { useState } from "react";
import { Loader2, Upload, AlertTriangle, Copy, Check } from "lucide-react";
import { Card, PageHeader, Button } from "@/components/ui";
import { safeStringify } from "@/lib/safe-storage";
import type { ExtractedPatternDraft } from "@/lib/exam-patterns";

const BOARDS = [
  { id: "cbse", label: "CBSE" }, { id: "kerala", label: "Kerala State" },
  { id: "tamilnadu", label: "Tamil Nadu" }, { id: "karnataka", label: "Karnataka" },
];

export default function ExamPatternExtractorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [board, setBoard] = useState("cbse");
  const [grade, setGrade] = useState("10");
  const [subject, setSubject] = useState("");

  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<ExtractedPatternDraft | null>(null);
  const [mismatches, setMismatches] = useState<string[]>([]);
  const [draftJson, setDraftJson] = useState("");
  const [copied, setCopied] = useState(false);

  async function extract() {
    if (!file) return;
    setExtracting(true); setError(""); setDraft(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/exam-patterns/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.draft);
      setMismatches(data.mismatches || []);
      setDraftJson(safeStringify(data.draft));
      if (!subject) setSubject(data.draft.subjectGuess || "");
    } catch (e: any) {
      setError(e.message || "Extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  function buildSnippet(): string {
    try {
      const edited = JSON.parse(draftJson);
      const id = `${board}-${grade}-${subject.toLowerCase().replace(/\s+/g, "-")}`;
      const snippet = {
        id, board, grade, subject,
        totalMarks: edited.totalMarks, durationMinutes: edited.durationMinutes,
        sections: edited.sections,
      };
      return `  ${JSON.stringify(snippet, null, 2).split("\n").join("\n  ")},`;
    } catch {
      return "// Fix the JSON above first — it's not valid.";
    }
  }

  function copySnippet() {
    navigator.clipboard.writeText(buildSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  let liveMismatches: string[] = [];
  try {
    const edited = JSON.parse(draftJson);
    liveMismatches = edited.sections?.map((s: any) => {
      const computed = s.blocks.reduce((sum: number, b: any) => sum + b.count * b.marksEach, 0);
      return s.totalMarks && computed !== s.totalMarks
        ? `${s.label}: blocks sum to ${computed} but section declares ${s.totalMarks}.` : null;
    }).filter(Boolean) || [];
  } catch { /* invalid JSON — handled by the snippet builder above */ }

  return (
    <div>
      <PageHeader eyebrow="Exam Room" title="Extract a pattern from a real sample paper"
        subtitle="Upload an official board sample paper PDF — Gemini reads the actual structure directly from the document, instead of researching secondary sources that can disagree with each other." />

      <Card className="mb-6">
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Board</div>
            <select value={board} onChange={e => setBoard(e.target.value)}
              className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk">
              {BOARDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Class</div>
            <input value={grade} onChange={e => setGrade(e.target.value)}
              className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk" />
          </div>
        </div>
        <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)}
          className="mb-4 w-full text-xs text-chalkdim" />
        <Button disabled={!file || extracting} onClick={extract}>
          {extracting ? <><Loader2 size={14} className="animate-spin" /> Reading the document…</> : <><Upload size={14} /> Extract structure</>}
        </Button>
        {error && <div className="mt-3 text-sm text-terracotta">{error}</div>}
      </Card>

      {draft && (
        <>
          <Card className="mb-4">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Subject (confirm or correct — the AI only guessed this from the paper's header)</div>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full rounded-lg border border-board3 bg-board px-3 py-2 text-sm text-chalk" />
          </Card>

          {(mismatches.length > 0 || liveMismatches.length > 0) && (
            <Card className="mb-4 border-terracotta/40 bg-terracotta/5">
              <div className="mb-2 flex items-center gap-1.5 text-sm text-terracotta">
                <AlertTriangle size={14} /> Marks don't add up — check these against the real document before using this pattern
              </div>
              <ul className="flex flex-col gap-1 text-xs text-chalkdim">
                {[...new Set([...mismatches, ...liveMismatches])].map((m, i) => <li key={i}>• {m}</li>)}
              </ul>
            </Card>
          )}

          <Card className="mb-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-chalkdim">
              Extracted structure — edit directly if anything looks wrong, then re-check against the real PDF
            </div>
            <textarea value={draftJson} onChange={e => setDraftJson(e.target.value)} rows={16}
              className="w-full rounded-lg border border-board3 bg-board px-3 py-2.5 font-mono text-xs text-chalk" />
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-wider text-marigold">
                Paste this into EXAM_PATTERNS in lib/exam-patterns.ts
              </div>
              <button onClick={copySnippet} className="inline-flex items-center gap-1.5 rounded-lg border border-board3 px-3 py-1.5 text-xs text-chalkdim hover:text-chalk">
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg border border-board3 bg-board p-3 text-[11px] text-chalkdim whitespace-pre-wrap">
              {buildSnippet()}
            </pre>
            <p className="mt-3 text-[11px] text-chalkdim">
              This is a draft, not published automatically — same principle the rest of Exam Room follows. Add it to the
              array by hand only after checking the numbers above against the actual sample paper.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
