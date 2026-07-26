"use client";
/**
 * TextbookShelf — the student's textbook home, lives on the Study
 * Materials page (this is where the "add a textbook PDF" provision
 * moved to, out of the Classroom).
 *
 * Flow, exactly as specified:
 *   1. Fill the form — Syllabus, Class (1–12), Subject, Language the
 *      material (book) is printed in.
 *   2. Upload the textbook PDF from the device → saved to the on-device
 *      IndexedDB library (lib/textbook-library.ts) with that metadata.
 *   3. The uploaded books are listed; each has a MAKE MATERIAL tab that
 *      first asks "in which language do you want to study?" and then
 *      has the AI prepare the material IN THAT LANGUAGE.
 *
 * Make Material reuses the app's verified kitchen pipeline
 * (/api/student/study-materials + continue-generation) rather than a
 * second generation path: the student picks which page of the book to
 * prepare (PDFPagePicker — the same picker used everywhere else), the
 * book's own language goes in as sourceLanguage, and the chosen study
 * language as targetLanguage. Teaching page-by-page with the spotlight
 * stays in the Classroom, which reads this same shelf.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen, ImagePlus, Loader2, Trash2, ArrowRight, Sparkles, X,
} from "lucide-react";
import { Card } from "@/components/ui";
import { PDFPagePicker } from "@/components/PDFPagePicker";
import { textbookLibrary, type TextbookMeta } from "@/lib/textbook-library";
import { getPdfPageCount } from "@/lib/client/pdf-page";
import { SUPPORTED_LANGUAGES, getLanguage } from "@/lib/languages";
import { STUDY_SUBJECTS, type StudyMaterial } from "@/lib/study-material-schema";

const BOARDS = [
  { id: "cbse",      label: "CBSE (NCERT)" },
  { id: "kerala",    label: "Kerala State" },
  { id: "tamilnadu", label: "Tamil Nadu" },
  { id: "karnataka", label: "Karnataka" },
];
const CLASSES = Array.from({ length: 12 }, (_, i) => String(i + 1)); // 1..12

interface Props {
  student: string;                 // student email — shelf isolation key
  defaultSyllabus: string;
  defaultClass: string;            // numeric grade from the profile, e.g. "8"
  defaultLanguage: string;
  /** Called with the freshly created material so the page can prepend it
   *  to its list and kick off stage-2 generation — same handling as the
   *  page's own prepare flow. */
  onMaterialCreated: (m: StudyMaterial) => void;
}

export function TextbookShelf({ student, defaultSyllabus, defaultClass, defaultLanguage, onMaterialCreated }: Props) {
  // ── Form (step 1) ──
  const [syllabus,  setSyllabus]  = useState(defaultSyllabus || "cbse");
  const [className, setClassName] = useState(CLASSES.includes(defaultClass) ? defaultClass : "8");
  const [subject,   setSubject]   = useState<string>(STUDY_SUBJECTS[0]);
  const [bookLang,  setBookLang]  = useState(defaultLanguage || "english");

  // ── Upload (step 2) ──
  const fileRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [error,  setError]  = useState("");

  // ── Shelf ──
  const [books, setBooks] = useState<TextbookMeta[]>([]);
  useEffect(() => { textbookLibrary.list(student).then(setBooks); }, [student]);

  // ── Make Material (step 3): which book's tab is open, which study
  // language is chosen, and the page-picker + preparing state ──
  const [makeForId,   setMakeForId]   = useState<string | null>(null);
  const [studyLang,   setStudyLang]   = useState(defaultLanguage || "english");
  const [pickerFile,  setPickerFile]  = useState<File | null>(null);
  const [preparing,   setPreparing]   = useState(false);
  const [madeForId,   setMadeForId]   = useState<string | null>(null);

  async function addBook(f: File | undefined | null) {
    if (!f) return;
    if (f.type !== "application/pdf") { setError("Please choose a PDF file."); return; }
    setAdding(true); setError("");
    try {
      const total = await getPdfPageCount(f);
      const meta  = await textbookLibrary.add(student, f, total, {
        syllabus, className, subject, language: bookLang,
      });
      setBooks(b => [meta, ...b]);
    } catch {
      setError("Couldn't read that PDF. Is the file complete?");
    } finally { setAdding(false); }
  }

  async function removeBook(id: string) {
    await textbookLibrary.remove(id);
    setBooks(b => b.filter(x => x.id !== id));
    if (makeForId === id) { setMakeForId(null); setPickerFile(null); }
  }

  function openMakeTab(book: TextbookMeta) {
    setMadeForId(null);
    if (makeForId === book.id) { setMakeForId(null); setPickerFile(null); return; }
    setMakeForId(book.id);
    setPickerFile(null);
    setStudyLang(defaultLanguage || book.language || "english");
  }

  async function chooseSection(book: TextbookMeta) {
    setError("");
    const file = await textbookLibrary.getFile(book.id);
    if (!file) { setError("That textbook is missing from this device — add it again."); return; }
    setPickerFile(file);
  }

  /** Page picked → have the AI prepare the material in the chosen study
   *  language, via the SAME kitchen API the page's own form uses. */
  async function makeMaterial(book: TextbookMeta, blob: Blob, pageNum: number) {
    setPickerFile(null); setPreparing(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], `page-${pageNum}.jpg`, { type: "image/jpeg" }));
      fd.append("studentId", student);
      fd.append("className", book.className || className);
      fd.append("syllabus",  book.syllabus  || syllabus);
      fd.append("subject",   book.subject   || subject);
      fd.append("sourceLanguage", book.language || "english");
      fd.append("targetLanguage", studyLang);

      const res  = await fetch("/api/student/study-materials", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onMaterialCreated(data.material);
      setMadeForId(book.id);
      setMakeForId(null);
    } catch (e: any) {
      setError(e.message || "Couldn't prepare the material. Try a clearer page.");
    } finally { setPreparing(false); }
  }

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-center gap-2">
        <BookOpen size={16} className="text-marigold" />
        <div className="font-display text-base text-chalk">My textbooks</div>
      </div>

      {/* ── Step 1: the form ── */}
      <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Syllabus</div>
          <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
            value={syllabus} onChange={e => setSyllabus(e.target.value)}>
            {BOARDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </div>
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Class</div>
          <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
            value={className} onChange={e => setClassName(e.target.value)}>
            {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Subject</div>
          <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
            value={subject} onChange={e => setSubject(e.target.value)}>
            {STUDY_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Book language</div>
          <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
            value={bookLang} onChange={e => setBookLang(e.target.value)}>
            {SUPPORTED_LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Step 2: upload the textbook PDF ── */}
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
        onChange={e => { addBook(e.target.files?.[0]); e.target.value = ""; }} />
      <button onClick={() => fileRef.current?.click()} disabled={adding}
        className="mb-4 w-full cursor-pointer rounded-xl border-2 border-dashed border-board3 bg-board2 p-5 text-center hover:border-marigold hover:bg-board3 transition-colors disabled:opacity-50">
        {adding
          ? <span className="inline-flex items-center gap-2 text-sm text-chalkdim"><Loader2 size={15} className="animate-spin" /> Reading your PDF…</span>
          : <>
              <ImagePlus size={22} className="mx-auto mb-2 text-marigold" />
              <div className="text-sm text-chalkdim">Upload your textbook PDF from this device</div>
              <div className="mt-1 text-xs text-chalkdim opacity-60">Whole book is fine — it stays on your device</div>
            </>}
      </button>

      {error && <div className="mb-3 text-xs text-terracotta">{error}</div>}

      {/* ── Step 3: the shelf, each book with its MAKE MATERIAL tab ── */}
      {books.length === 0 ? (
        <p className="text-xs text-chalkdim/70">
          Your uploaded textbooks will be listed here — each with a Make Material button and
          ready to teach page-by-page in the Classroom.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {books.map(b => (
            <div key={b.id} className="rounded-lg border border-board3 bg-board2">
              <div className="flex items-center gap-3 p-3">
                <BookOpen size={16} className="shrink-0 text-marigold" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-chalk">{b.name}</div>
                  <div className="font-mono text-[10px] text-chalkdim">
                    {BOARDS.find(x => x.id === b.syllabus)?.label || b.syllabus || "—"}
                    {" · "}Class {b.className || "?"} · {b.subject || "—"}
                    {" · "}{getLanguage(b.language || "english").label}
                    {" · "}{b.totalPages} pages
                    {b.lastPageTaught > 0 && ` · taught to p.${b.lastPageTaught}`}
                  </div>
                </div>
                {madeForId === b.id && (
                  <span className="shrink-0 font-mono text-[10px] text-marigold">✓ Material ready below</span>
                )}
                <button onClick={() => openMakeTab(b)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold transition-colors ${
                    makeForId === b.id
                      ? "bg-marigold text-board"
                      : "border border-marigold/40 bg-marigold/10 text-marigold hover:bg-marigold/20"
                  }`}>
                  <Sparkles size={11} /> Make Material
                </button>
                <Link href="/classroom" title="Teach this book page-by-page"
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-board3 px-2.5 py-1.5 font-mono text-[10px] text-chalkdim hover:text-chalk hover:border-marigold/50 transition-colors">
                  Classroom <ArrowRight size={10} />
                </Link>
                <button onClick={() => removeBook(b.id)} title="Remove from shelf"
                  className="shrink-0 rounded-lg border border-board3 p-1.5 text-chalkdim hover:text-terracotta transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>

              {/* MAKE MATERIAL tab: ask the study language, then pick the page */}
              {makeForId === b.id && (
                <div className="border-t border-board3 p-3">
                  {preparing ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-chalkdim">
                      <Loader2 size={15} className="animate-spin text-marigold" />
                      Making your material in {getLanguage(studyLang).label}…
                    </div>
                  ) : pickerFile ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-chalkdim">
                          Pick the page to make material from
                        </span>
                        <button onClick={() => setPickerFile(null)}
                          className="rounded p-1 text-chalkdim hover:text-terracotta"><X size={12} /></button>
                      </div>
                      <PDFPagePicker
                        file={pickerFile}
                        onPageSelected={(blob, pageNum) => makeMaterial(b, blob, pageNum)}
                        onCancel={() => setPickerFile(null)}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[180px]">
                        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">
                          In which language do you want to study?
                        </div>
                        <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                          value={studyLang} onChange={e => setStudyLang(e.target.value)}>
                          {SUPPORTED_LANGUAGES.map(l => (
                            <option key={l.id} value={l.id}>{l.label} — {l.nativeLabel}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => chooseSection(b)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-marigold px-3.5 py-2 font-mono text-[11px] font-semibold text-board hover:bg-marigolddim transition-colors">
                        Choose page & make <ArrowRight size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
