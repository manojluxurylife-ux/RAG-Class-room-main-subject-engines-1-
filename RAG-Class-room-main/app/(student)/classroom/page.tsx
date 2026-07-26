"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Send, RotateCcw, Loader2, BookOpen, ImagePlus, X, FileImage, ArrowRight, ChefHat, Mic, Camera, Library, ChevronLeft, ChevronRight } from "lucide-react";
import { useSpeechInput } from "@/lib/use-speech-input";
import { textbookLibrary, type TextbookMeta } from "@/lib/textbook-library";
import { renderPdfPageToJpeg } from "@/lib/client/pdf-page";
import { TextbookPageView } from "@/components/TextbookPageView";
import { Button, Card } from "@/components/ui";
import { Typewriter, SPEED_LEVELS } from "@/components/Typewriter";
import { PDFPagePicker } from "@/components/PDFPagePicker";
import { extractPageText } from "@/lib/client/pdf-text";
import { studentSession } from "@/lib/student-session";
import { studentKey, callGeminiClient, callGeminiClientVision } from "@/lib/student-key";
import { offlineAI } from "@/lib/offline-ai";
import { generateWithSelectedAI } from "@/lib/client-ai-router";
import { DiagramRenderer } from "@/components/visuals/DiagramRenderer";
import { gradeBandGuidance, languageInstruction, lessonSystemPrompt, qaSystemPrompt } from "@/lib/teacher-prompts-client";
import { parseAiJson } from "@/lib/safe-json";
import type { StudyMaterial } from "@/lib/study-material-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lesson = {
  title: string;
  points: string[];
  /** Textbook classes only: verbatim page phrases, parallel to `points`
   *  ("" where a point has no source line) — drives the page spotlight. */
  spotlights?: string[];
  example: { problem: string; steps: string[]; answer: string };
  checkQuestion: string;
  visual?: unknown;
};

type Line = { id: string; section: string; text: string; idx: number };

function buildLines(lesson: Lesson | null): Line[] {
  if (!lesson) return [];
  const raw: Omit<Line, "idx">[] = [];
  lesson.points.forEach((t, i) => raw.push({ id: `point-${i}`, section: "point", text: t }));
  if (lesson.example) {
    raw.push({ id: "ex-problem", section: "ex-problem", text: lesson.example.problem });
    lesson.example.steps.forEach((t, i) =>
      raw.push({ id: `ex-step-${i}`, section: "ex-step", text: t }),
    );
    raw.push({ id: "ex-answer", section: "ex-answer", text: lesson.example.answer });
  }
  if (lesson.checkQuestion) raw.push({ id: "check", section: "check", text: lesson.checkQuestion });
  return raw.map((l, idx) => ({ ...l, idx }));
}

// ─── Classroom ────────────────────────────────────────────────────────────────

function ClassroomInner() {
  const params = useSearchParams();
  const router = useRouter();

  // Read profile from session (set at signup/login).
  // Fall back to query params so direct URLs still work during dev.
  const sessionProfile = typeof window !== "undefined" ? studentSession.get() : null;
  const profile = {
    name:       sessionProfile?.name       || params.get("name")     || "Student",
    languageId: sessionProfile?.languageId || params.get("language") || "english",
    boardId:    sessionProfile?.syllabus   || params.get("board")    || "cbse",
    grade:      sessionProfile?.grade      || params.get("grade")    || "8",
  };

  // ── General ──
  const [stage,     setStage]     = useState<"select"|"loading"|"lesson">("select");
  const [preparedMaterials, setPreparedMaterials] = useState<StudyMaterial[]>([]);
  const [loadingMaterials,  setLoadingMaterials]  = useState(true);
  const [subjectFilter,     setSubjectFilter]     = useState<string | null>(null);
  const [typeSpeed, setTypeSpeed] = useState("normal");

  // ── Textbook mode: "idle" | "image" | "pdf-picker" ──
  const [tbMode,       setTbMode]       = useState(false);
  const [tbSubMode,    setTbSubMode]    = useState<"idle"|"image"|"pdf-picker">("idle");
  const [tbImageFile,  setTbImageFile]  = useState<File | null>(null);   // direct image upload
  const [tbPdfFile,    setTbPdfFile]    = useState<File | null>(null);   // PDF for picker
  const [tbPreview,    setTbPreview]    = useState<string | null>(null); // object URL shown alongside lesson
  const [tbPageInfo,   setTbPageInfo]   = useState<{ page: number; total: number } | null>(null);
  const tbInputRef = useRef<HTMLInputElement>(null);
  // Saving the SAME uploaded page into Study Materials — no second upload
  const [savingAsMaterial,  setSavingAsMaterial]  = useState(false);
  const [savedMaterialId,   setSavedMaterialId]   = useState<string | null>(null);
  const [saveMaterialError, setSaveMaterialError] = useState("");

  // ── Topic ──
  const [customTopic, setCustomTopic] = useState("");
  const [topicLabel,  setTopicLabel]  = useState("");

  // ── Lesson ──
  const [lesson,     setLesson]     = useState<Lesson | null>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [error,      setError]      = useState("");
  const [usedOffline, setUsedOffline] = useState(false);   // true when the current lesson/answer came from the offline fallback

  // ── Q&A ──
  const [thread,      setThread]      = useState<{ role: "student"|"teacher"; text: string }[]>([]);
  const [typedMsgIds, setTypedMsgIds] = useState<Set<number>>(new Set());
  const [question,    setQuestion]    = useState("");
  const [qaLoading,   setQaLoading]   = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // ── Q&A camera + mic (in-classroom, same style as the rest of the
  // board UI). The camera here is snapshot-based — one photo of the
  // textbook problem attached to the next question — deliberately NOT a
  // second live video session, so it never competes with the global
  // floating dock (GlobalDoubtDock) for the device camera. ──
  const [qaPhoto,        setQaPhoto]        = useState<File | null>(null);
  const [qaPhotoPreview, setQaPhotoPreview] = useState<string | null>(null);
  const qaCamRef = useRef<HTMLInputElement>(null);

  function attachQaPhoto(f: File | undefined | null) {
    if (!f) return;
    if (qaPhotoPreview) URL.revokeObjectURL(qaPhotoPreview);
    setQaPhoto(f);
    setQaPhotoPreview(URL.createObjectURL(f));
  }
  function clearQaPhoto() {
    if (qaPhotoPreview) URL.revokeObjectURL(qaPhotoPreview);
    setQaPhoto(null);
    setQaPhotoPreview(null);
  }

  // Mic dictation in the student's OWN language (same getSpeechLang
  // mapping the narration features already use). Two independent
  // targets: the topic box on the select screen, the question box in
  // the lesson thread.
  const topicMic = useSpeechInput(profile.languageId, text =>
    setCustomTopic(prev => (prev ? prev + " " : "") + text));
  const qaMic = useSpeechInput(profile.languageId, text =>
    setQuestion(prev => (prev ? prev + " " : "") + text));

  /** File → raw base64 (no data-URL prefix) for the Gemini vision call. */
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = () => reject(new Error("Couldn't read the photo."));
      r.readAsDataURL(file);
    });
  }

  // ── Bookshelf: the student's uploaded textbook PDFs (on-device,
  // lib/textbook-library.ts) — shown above the board. Selecting a book
  // opens it beside the board and teaching resumes from the page AFTER
  // the last one taught, like a real teacher continuing the syllabus. ──
  const [books,          setBooks]          = useState<TextbookMeta[]>([]);
  const [activeBook,     setActiveBook]     = useState<TextbookMeta | null>(null);
  const [activeBookFile, setActiveBookFile] = useState<File | null>(null);
  const [bookPage,       setBookPage]       = useState(1);
  const [manualSpot,     setManualSpot]     = useState<number | null>(null); // student tapped a point

  useEffect(() => {
    const p = studentSession.get();
    if (!p) return;
    textbookLibrary.list(p.email).then(setBooks);
  }, []);

  /** Open a book: resume at the page AFTER the last class stopped. */
  async function openBook(book: TextbookMeta) {
    const file = await textbookLibrary.getFile(book.id);
    if (!file) { setError("That textbook is missing from this device — add it again."); return; }
    const startPage = Math.min(Math.max(book.lastPageTaught + 1, 1), book.totalPages || 1);
    setActiveBook(book);
    setActiveBookFile(file);
    await teachBookPage(book, file, startPage);
  }

  /** Teach one page of the open textbook — the heart of textbook-based
   *  teaching. Renders the page to JPEG (same 2× export scale the
   *  verified Textbook mode uses), extracts the text layer, then goes
   *  BYOK vision first / server /api/textbook second — both paths now
   *  return `spotlights` for the page-beam. */
  async function teachBookPage(book: TextbookMeta, file: File, page: number) {
    const label = `${book.name} — page ${page}`;
    setTopicLabel(label); setStage("loading");
    setError(""); setThread([]); setTypedMsgIds(new Set()); setUsedOffline(false);
    setManualSpot(null); setBookPage(page);
    try {
      const [pageBlob, pageText] = await Promise.all([
        renderPdfPageToJpeg(file, page),
        extractPageText(file, page),
      ]);

      const byokKey = studentKey.get();
      let newLesson: Lesson;

      if (byokKey) {
        const system = lessonSystemPrompt({ grade: profile.grade, boardId: profile.boardId, languageId: profile.languageId, fromTextbook: true });
        const textContext = pageText
          ? `\n\nExtracted text from this page (may contain artefacts — the image is ground truth):\n"""\n${pageText.slice(0, 3000)}\n"""`
          : "";
        const userPrompt = `Please teach the maths on page ${page} of ${book.totalPages} from this textbook.${textContext}`;
        const b64 = await fileToBase64(new File([pageBlob], "page.jpg", { type: "image/jpeg" }));
        const raw = await callGeminiClientVision(system, userPrompt, b64, "image/jpeg", byokKey);
        newLesson = parseAiJson(raw);
      } else {
        const fd = new FormData();
        fd.append("file", new File([pageBlob], `page-${page}.jpg`, { type: "image/jpeg" }));
        fd.append("grade", profile.grade);
        fd.append("boardId", profile.boardId);
        fd.append("languageId", profile.languageId);
        if (pageText) fd.append("pageText", pageText);
        fd.append("pageNumber", String(page));
        fd.append("totalPages", String(book.totalPages));
        const res  = await fetch("/api/textbook", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        newLesson = data.lesson;
      }

      setLesson(newLesson); setTypedCount(0); setStage("lesson");
      studentSession.addLesson(label, profile.boardId, profile.grade);
      // Forward-only resume pointer — next class starts at page + 1.
      await textbookLibrary.markPageTaught(book.id, page);
      const bumped = { ...book, lastPageTaught: Math.max(book.lastPageTaught, page) };
      setActiveBook(bumped);
      setBooks(bs => bs.map(b => (b.id === book.id ? bumped : b)));
    } catch {
      setError("AI Guru couldn't read that page. Please try again.");
      setStage("select");
    }
  }

  /** The teacher's current spotlight phrase: follows the point being
   *  typed on the board; a student tap on any point overrides it; once
   *  the class moves past the points to the worked example, the beam
   *  switches off (the teacher is now at the board, not the book). */
  const activeSpotlight = useMemo(() => {
    if (!activeBook || !lesson?.spotlights?.length) return null;
    const spots = lesson.spotlights;
    if (manualSpot !== null) return spots[manualSpot] || null;
    const nPoints = lesson.points?.length || 0;
    if (nPoints === 0) return null;
    if (typedCount >= nPoints) return null;   // past the points → beam off
    return spots[Math.min(typedCount, spots.length - 1)] || null;
  }, [activeBook, lesson, manualSpot, typedCount]);

  // ── Derived ──
  const lines        = useMemo(() => buildLines(lesson), [lesson]);
  const speedMs      = SPEED_LEVELS.find(s => s.id === typeSpeed)?.ms ?? 16;
  const pointLines   = lines.filter(l => l.section === "point");
  const exampleLines = lines.filter(l => l.section.startsWith("ex-"));
  const checkLine    = lines.find(l => l.section === "check");
  const lessonTyping = lines.length > 0 && typedCount < lines.length;
  const exStarted    = exampleLines.length > 0 && typedCount >= exampleLines[0].idx;
  const checkStarted = !!(checkLine && typedCount >= checkLine.idx);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, qaLoading]);

  // Load the student's prepared study materials (from the Kitchen,
  // /study-materials) so they're accessible right here in the Classroom too.
  useEffect(() => {
    const p = studentSession.get();
    if (!p) { setLoadingMaterials(false); return; }
    fetch(`/api/student/study-materials?studentId=${encodeURIComponent(p.email)}`)
      .then(r => r.json())
      .then(d => setPreparedMaterials(d.materials || []))
      .finally(() => setLoadingMaterials(false));
  }, []);

  // Group prepared materials by subject for the filter chips — only
  // subjects the student actually has materials in ever show up.
  const materialsBySubject = useMemo(() => {
    const grouped: Record<string, StudyMaterial[]> = {};
    for (const m of preparedMaterials) {
      (grouped[m.subject] ||= []).push(m);
    }
    return grouped;
  }, [preparedMaterials]);

  // Clean up object URLs on unmount
  useEffect(() => () => { if (tbPreview) URL.revokeObjectURL(tbPreview); }, []);

  // ── Pick up a file shared in via the PWA Share Target (see
  // app/share-target/route.ts) — e.g. a student downloaded an official
  // textbook PDF and shared it straight into AI Guru instead of
  // manually browsing for it in the upload picker. ──
  useEffect(() => {
    if (params.get("fromShare") !== "1") return;
    try {
      const raw = sessionStorage.getItem("gg_shared_file");
      if (!raw) return;
      sessionStorage.removeItem("gg_shared_file");
      const { base64, name, type } = JSON.parse(raw);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], name, { type });
      setTbMode(true);
      handleFileInput(file);
    } catch {
      // Malformed/expired handoff — fail silently, student can upload manually.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File handling ──

  function handleFileInput(file: File | null | undefined) {
    if (!file) return;
    setError("");
    if (file.type === "application/pdf") {
      setTbPdfFile(file);
      setTbImageFile(null);
      setTbSubMode("pdf-picker");
    } else {
      // Direct image upload — skip picker
      if (tbPreview) URL.revokeObjectURL(tbPreview);
      setTbImageFile(file);
      setTbPdfFile(null);
      setTbPreview(URL.createObjectURL(file));
      setTbSubMode("image");
    }
  }

  function clearTbFile() {
    if (tbPreview) URL.revokeObjectURL(tbPreview);
    setTbImageFile(null); setTbPdfFile(null);
    setTbPreview(null);   setTbPageInfo(null);
    setTbSubMode("idle");
  }

  /**
   * Called by PDFPagePicker once the user picks a page and it's been rasterised.
   * blob     — JPEG of the selected page at 2× scale
   * pageNum  — 1-based page number
   * total    — total pages in the PDF
   */
  async function handlePageSelected(blob: Blob, pageNum: number, total: number) {
    if (tbPreview) URL.revokeObjectURL(tbPreview);
    const imgFile = new File([blob], `page-${pageNum}.jpg`, { type: "image/jpeg" });
    setTbImageFile(imgFile);
    setTbPreview(URL.createObjectURL(blob));
    setTbPageInfo({ page: pageNum, total });
    setTbSubMode("image");
  }

  // ── Typewriter line helper ──
  // isActive = true for the line currently being typed (the "spotlight");
  // false for lines already finished (dimmed, but still visible — like a
  // teacher's spotlight that has moved on, not erased what came before).
  function typedLine(line: Line | undefined, wrap: (c: React.ReactNode, isActive: boolean) => React.ReactNode) {
    if (!line || line.idx > typedCount) return null;
    const isActive = line.idx === typedCount;
    const content = line.idx < typedCount ? (
      line.text
    ) : (
      <Typewriter text={line.text} speed={speedMs} onDone={() => setTypedCount(c => c + 1)} />
    );
    return wrap(content, isActive);
  }

  // ── Start from topic ──
  async function startClass(label: string) {
    setTopicLabel(label); setStage("loading");
    setError(""); setThread([]); setTypedMsgIds(new Set()); setUsedOffline(false);
    try {
      const system  = lessonSystemPrompt({ grade: profile.grade, boardId: profile.boardId, languageId: profile.languageId });
      const routed = await generateWithSelectedAI({
        task: "classroom",
        system,
        prompt: `Teach this topic: ${label}`,
        serverCall: async () => {
          const res = await fetch("/api/lesson", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:label,...profile})});
          const data=await res.json(); if(!res.ok) throw new Error(data.error); return JSON.stringify(data.lesson);
        }
      });
      const lesson = parseAiJson(routed.text);
      setUsedOffline(routed.provider === "qwen-local");

      setLesson(lesson); setTypedCount(0); setStage("lesson");
      studentSession.addLesson(label, profile.boardId, profile.grade);
    } catch {
      setError("AI Guru's chalk ran out. Please try again.");
      setStage("select");
    }
  }

  // ── Save from Teach-from-textbook straight into Study Materials —
  // reuses the SAME already-uploaded tbImageFile, no second upload.
  async function saveAsStudyMaterial() {
    if (!tbImageFile || !sessionProfile) return;
    setSavingAsMaterial(true); setSaveMaterialError(""); setSavedMaterialId(null);
    try {
      const fd = new FormData();
      fd.append("file", tbImageFile);
      fd.append("studentId", sessionProfile.email);
      fd.append("className", sessionProfile.className || "VIII");
      fd.append("syllabus", profile.boardId);
      fd.append("subject", "Mathematics"); // Classroom is the maths product; change subject in Study Materials if needed
      fd.append("sourceLanguage", profile.languageId);
      fd.append("targetLanguage", profile.languageId);

      const res  = await fetch("/api/student/study-materials", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedMaterialId(data.material.id);
    } catch (e: any) {
      setSaveMaterialError(e.message || "Could not save this as a study material.");
    } finally {
      setSavingAsMaterial(false);
    }
  }

  // ── Start from textbook page (image or rasterised PDF page) ──
  async function startClassFromImage() {
    if (!tbImageFile) return;
    setTopicLabel(tbPageInfo ? `textbook page ${tbPageInfo.page}` : "textbook page");
    setStage("loading");
    setError(""); setThread([]); setTypedMsgIds(new Set());

    try {
      // Extract text layer in parallel with the loading screen
      // (works on digital PDFs; returns "" for scanned pages — that's fine)
      const pageText = tbPdfFile && tbPageInfo
        ? await extractPageText(tbPdfFile, tbPageInfo.page)
        : "";

      const fd = new FormData();
      fd.append("file",       tbImageFile);
      fd.append("grade",      profile.grade);
      fd.append("boardId",    profile.boardId);
      fd.append("languageId", profile.languageId);
      if (pageText)               fd.append("pageText",   pageText);
      if (tbPageInfo?.page)       fd.append("pageNumber", String(tbPageInfo.page));
      if (tbPageInfo?.total)      fd.append("totalPages", String(tbPageInfo.total));

      const res  = await fetch("/api/textbook", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLesson(data.lesson); setTypedCount(0); setStage("lesson");
      studentSession.addLesson(topicLabel, profile.boardId, profile.grade);
    } catch (e: any) {
      setError(e.message || "Couldn't read the page. Try a clearer photo.");
      setStage("select");
    }
  }

  // ── Q&A ──
  async function askQuestion() {
    const q = question.trim();
    const photo = qaPhoto;
    if ((!q && !photo) || qaLoading) return;
    // With a photo but no typed text, ask the natural default — the
    // student pointed the camera at a problem, so teach that problem.
    const effectiveQ = q || "Explain this problem from my textbook photo, step by step.";
    setQuestion("");
    setThread(t => [...t, { role: "student", text: (photo ? "📷 " : "") + effectiveQ }]);
    setQaLoading(true);
    try {
      const byokKey = studentKey.get();
      const system  = qaSystemPrompt({ topic: topicLabel, grade: profile.grade, boardId: profile.boardId, languageId: profile.languageId });
      let answer: string;

      if (photo) {
        // ── Photo question: vision path. Primary = the student's own
        // Gemini key via callGeminiClientVision (same helper Textbook
        // mode uses); fallback = the on-device vision model, which
        // genuinely reads the image (offline-ai.generateWithImage). ──
        clearQaPhoto();
        try {
          if (byokKey) {
            const b64 = await fileToBase64(photo);
            answer = (await callGeminiClientVision(
              system, effectiveQ, b64, photo.type || "image/jpeg", byokKey,
            )).trim();
          } else if (offlineAI.getVisionStatus() === "ready") {
            answer = (await offlineAI.generateWithImage(system, effectiveQ, await photo.arrayBuffer())).trim();
            setUsedOffline(true);
          } else {
            throw new Error("no-vision");
          }
        } catch (visionErr: any) {
          if (offlineAI.getVisionStatus() === "ready") {
            answer = (await offlineAI.generateWithImage(system, effectiveQ, await photo.arrayBuffer())).trim();
            setUsedOffline(true);
          } else if (visionErr?.message === "no-vision") {
            answer = "I couldn't look at your photo — set up your free Gemini key in Settings (or download the offline vision model) and try again. You can still type the question and I'll answer!";
          } else {
            throw visionErr;
          }
        }
        setThread(t => [...t, { role: "teacher", text: answer }]);
        return;
      }

      const routed = await generateWithSelectedAI({
        task:"rag_answer", system, prompt:q,
        serverCall:async()=>{const res=await fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,topic:topicLabel,...profile})});const data=await res.json();if(!res.ok)throw new Error(data.error);return data.answer;}
      });
      answer=routed.text.trim(); setUsedOffline(routed.provider==="qwen-local");

      setThread(t => [...t, { role: "teacher", text: answer }]);
    } catch {
      setThread(t => [...t, { role: "teacher", text: "Sorry, could you ask that again?" }]);
    } finally { setQaLoading(false); }
  }

  // ── Reset ──
  function reset() {
    setStage("select"); setLesson(null); setTypedCount(0);
    setThread([]); setTypedMsgIds(new Set());
    setCustomTopic(""); setError("");
    setActiveBook(null); setActiveBookFile(null); setManualSpot(null);
    // keep tbImageFile / tbPreview so user can re-teach the same page
  }

  // ────────────────────────────────── Render ──────────────────────────────────

  return (
    <div>

      {/* The "ask anytime" camera/mic pane is now the GLOBAL floating
          hardware dock mounted in the student layout (GlobalDoubtDock) —
          always visible on every page, exactly like the reference app —
          so the page-local trigger button and modal were removed to
          avoid rendering two docks. */}

      {/* Profile chip */}
      <div className="mb-5 rounded-lg border border-board3 bg-board2 px-4 py-2.5 text-xs text-chalkdim flex items-center gap-2">
        <span>👋 {profile.name} · Class {profile.grade}</span>
        {usedOffline && (
          <span className="ml-auto font-mono text-[10px] text-terracotta border border-terracotta/40 rounded-full px-2 py-0.5">
            📴 Offline model
          </span>
        )}
        {!usedOffline && studentKey.hasKey() && (
          <span className="ml-auto font-mono text-[10px] text-marigold border border-marigold/40 rounded-full px-2 py-0.5">
            BYOK ✓
          </span>
        )}
        {tbPageInfo && (
          <span className="font-mono text-[10px] text-marigold">
            PDF p.{tbPageInfo.page}/{tbPageInfo.total}
          </span>
        )}
      </div>

      {/* ── MY TEXTBOOKS — the student's uploaded PDFs, above the board.
          Tap a book to open it beside the board; class resumes from the
          page AFTER where the last class stopped. ── */}
      {stage !== "loading" && sessionProfile && (
        <div className="mb-5 rounded-lg border border-board3 bg-board2 px-3 py-2.5">
          <div className="mb-2 flex items-center gap-2">
            <Library size={13} className="text-marigold shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-chalkdim">
              My textbooks
            </span>
            {/* Adding books happens in Study Materials now — one home for
                the upload form + metadata, this shelf just teaches. */}
            <Link href="/study-materials"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-board3 bg-board px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-chalkdim hover:text-marigold hover:border-marigold/50 transition-colors">
              <ImagePlus size={11} /> Add in Study Materials
            </Link>
          </div>

          {books.length === 0 ? (
            <p className="text-xs text-chalkdim/70">
              Upload your textbook PDF in <Link href="/study-materials" className="text-marigold underline underline-offset-2">Study Materials</Link> —
              then every class continues from where the last one stopped.
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {books.map(b => {
                const isOpen   = activeBook?.id === b.id;
                const nextPage = Math.min(Math.max(b.lastPageTaught + 1, 1), b.totalPages || 1);
                const done     = b.totalPages > 0 && b.lastPageTaught >= b.totalPages;
                return (
                  <div key={b.id}
                    className={`shrink-0 max-w-[220px] rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                      isOpen
                        ? "border-marigold bg-marigold/10"
                        : "border-board3 bg-board hover:border-marigold/50"
                    }`}
                    onClick={() => !isOpen && openBook(b)}
                    title={done ? "Finished — tap to revise the last page" : `Continue from page ${nextPage}`}>
                    <div className={`flex items-center gap-1.5 text-xs truncate ${isOpen ? "text-marigold" : "text-chalk"}`}>
                      <BookOpen size={12} className="shrink-0" />
                      <span className="truncate">{b.name}</span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-chalkdim">
                      {done
                        ? `✓ finished · ${b.totalPages} pages`
                        : b.lastPageTaught > 0
                          ? `stopped at p.${b.lastPageTaught} → next p.${nextPage}`
                          : `new · ${b.totalPages} pages`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Speed bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-chalkdim">Speed</span>
        <div className="flex flex-wrap gap-1 rounded-full border border-board3 bg-board2 p-1">
          {SPEED_LEVELS.map(s => (
            <button key={s.id} onClick={() => setTypeSpeed(s.id)}
              className={`rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors ${
                typeSpeed === s.id ? "bg-marigold text-board font-semibold" : "text-chalkdim hover:text-chalk"
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SELECT ── */}
      {stage === "select" && (
        <div>
          {/* Mode toggle */}
          <div className="mb-5 flex w-fit gap-1 rounded-full border border-board3 bg-board2 p-1">
            <button onClick={() => setTbMode(false)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[11px] transition-colors ${
                !tbMode ? "bg-marigold text-board font-semibold" : "text-chalkdim hover:text-chalk"
              }`}>
              Choose a topic
            </button>
            <button onClick={() => setTbMode(true)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[11px] transition-colors ${
                tbMode ? "bg-marigold text-board font-semibold" : "text-chalkdim hover:text-chalk"
              }`}>
              <BookOpen size={11} /> Teach from textbook
            </button>
          </div>

          {/* ── TOPIC MODE ── */}
          {!tbMode && (
            <>
              {/* Your prepared materials, organized by subject — replaces the old
                  hardcoded generic topic chips (Fractions/Linear Equations/etc.)
                  with what the student actually uploaded and prepared in the
                  Kitchen (/study-materials). This is the one place that view
                  lives — not duplicated elsewhere in Classroom. */}
              {!loadingMaterials && preparedMaterials.length === 0 && (
                <Link href="/study-materials" className="mb-5 block">
                  <Card className="flex items-center gap-3 py-3.5 hover:border-marigold/60 transition-colors">
                    <ChefHat size={16} className="text-marigold shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-chalk">No study materials prepared yet</div>
                      <div className="text-xs text-chalkdim">Upload a textbook page in Study Materials to get started</div>
                    </div>
                    <ArrowRight size={14} className="text-chalkdim shrink-0" />
                  </Card>
                </Link>
              )}

              {!loadingMaterials && preparedMaterials.length > 0 && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-display text-base text-chalk">Your study materials</div>
                    <Link href="/study-materials" className="font-mono text-[10px] text-chalkdim hover:text-marigold">
                      Prepare more →
                    </Link>
                  </div>

                  {/* Subject filter chips — only subjects the student actually has materials for */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button onClick={() => setSubjectFilter(null)}
                      className={`rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                        subjectFilter === null ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/40"
                      }`}>
                      All ({preparedMaterials.length})
                    </button>
                    {Object.entries(materialsBySubject).map(([subj, items]) => (
                      <button key={subj} onClick={() => setSubjectFilter(subj)}
                        className={`rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                          subjectFilter === subj ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/40"
                        }`}>
                        {subj} ({items.length})
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    {(subjectFilter ? materialsBySubject[subjectFilter] || [] : preparedMaterials).map(m => {
                      const total = m.segments.length;
                      const pct   = total > 0 ? Math.round((m.progress.unlockedIndex / total) * 100) : 0;
                      const started = m.progress.unlockedIndex > 0;
                      return (
                        <Link key={m.id} href={`/classroom/study/${m.id}`}>
                          <Card className="py-3 hover:border-marigold/60 transition-colors">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm text-chalk truncate">{m.title}</div>
                                <div className="font-mono text-[10px] text-chalkdim mt-0.5">
                                  {m.subject} · {total} segments
                                </div>
                              </div>
                              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-marigold px-3 py-1.5 font-mono text-[10px] font-semibold text-board">
                                {started ? "Continue" : "Start class"} <ArrowRight size={10} />
                              </span>
                            </div>
                            <div className="mt-2 h-1 w-full rounded-full bg-board3 overflow-hidden">
                              <div className="h-full bg-marigold transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Free-form ad-hoc topic — separate from prepared materials above;
                  useful for a quick lesson on something not yet uploaded/prepared. */}
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-chalkdim">
                Or ask about any topic
              </div>
              <div className="flex gap-2">
                {/* Mic — say the topic aloud in the student's own language */}
                {topicMic.supported && (
                  <button onClick={topicMic.toggle}
                    title={topicMic.listening ? "Stop listening" : "Say a topic"}
                    className={`shrink-0 rounded-lg border px-3 py-2.5 transition-colors ${
                      topicMic.listening
                        ? "border-terracotta bg-terracotta/20 text-terracotta animate-pulse"
                        : "border-board3 bg-board2 text-chalkdim hover:text-chalk hover:bg-board3"
                    }`}>
                    <Mic size={16} />
                  </button>
                )}
                <input className="flex-1 rounded-lg border border-board3 bg-board2 px-3.5 py-2.5 text-sm text-chalk placeholder:text-chalkdim/60"
                  placeholder={topicMic.listening ? "Listening… say the topic" : "Or type any maths topic…"}
                  value={customTopic}
                  onChange={e => setCustomTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && customTopic.trim() && startClass(customTopic.trim())} />
                <Button disabled={!customTopic.trim()} onClick={() => startClass(customTopic.trim())}>Start</Button>
              </div>
            </>
          )}

          {/* ── TEXTBOOK MODE ── */}
          {tbMode && (
            <div>
              <p className="mb-4 text-sm text-chalkdim">
                Upload a photo or PDF of the textbook page. AI Guru will read the page
                and teach the maths on it — including diagrams and worked examples.
              </p>

              {/* ── IDLE: Upload zone ── */}
              {tbSubMode === "idle" && (
                <div>
                  <div onClick={() => tbInputRef.current?.click()}
                    className="mb-3 cursor-pointer rounded-xl border-2 border-dashed border-board3 bg-board2 p-8 text-center hover:border-marigold hover:bg-board3 transition-colors relative">
                    <input ref={tbInputRef} type="file" accept="image/*,application/pdf"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={e => handleFileInput(e.target.files?.[0])} />
                    <ImagePlus size={28} className="mx-auto mb-3 text-marigold" />
                    <div className="text-sm text-chalkdim">Tap to upload a textbook page</div>
                    <div className="mt-1 text-xs text-chalkdim opacity-60">
                      JPG / PNG — or a multi-page PDF (pick which page to teach)
                    </div>
                  </div>

                  {/* Hint row */}
                  <div className="flex gap-3 rounded-lg border border-board3 bg-board2 p-3">
                    <FileImage size={14} className="text-marigold shrink-0 mt-0.5" />
                    <p className="text-xs text-chalkdim leading-relaxed">
                      <b className="text-chalk">PDF:</b> all pages shown as thumbnails — pick one.
                      Text is extracted automatically from digital PDFs; scanned pages are read from the image.
                      <br />
                      <b className="text-chalk">Photo:</b> a clear, well-lit photo of the page works best.
                    </p>
                  </div>
                </div>
              )}

              {/* ── PDF PICKER ── */}
              {tbSubMode === "pdf-picker" && tbPdfFile && (
                <PDFPagePicker
                  file={tbPdfFile}
                  onPageSelected={handlePageSelected}
                  onCancel={clearTbFile}
                />
              )}

              {/* ── IMAGE READY ── */}
              {tbSubMode === "image" && tbImageFile && (
                <div>
                  {tbPreview && (
                    <div className="relative mb-4 overflow-hidden rounded-xl border border-board3 bg-board2">
                      <img src={tbPreview} alt="Selected page" className="w-full max-h-80 object-contain block" />
                      <button onClick={clearTbFile}
                        className="absolute top-2 right-2 flex items-center rounded-full border border-board3 bg-board p-1.5 text-chalkdim hover:text-terracotta">
                        <X size={13} />
                      </button>
                      {tbPageInfo && (
                        <div className="absolute bottom-0 left-0 right-0 bg-board/80 py-1 text-center font-mono text-[10px] text-chalkdim">
                          Page {tbPageInfo.page} of {tbPageInfo.total}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={startClassFromImage}>
                      <BookOpen size={14} />
                      {tbPageInfo ? `Teach from page ${tbPageInfo.page}` : "Teach from this page"}
                    </Button>
                    <Button variant="ghost" onClick={clearTbFile}>Change</Button>
                  </div>

                  {/* Same uploaded page, no re-upload — turn it into a saved,
                      revisitable, quiz-gated course instead of (or as well
                      as) a one-off lesson. */}
                  <div className="mt-3">
                    {savedMaterialId ? (
                      <Link href={`/classroom/study/${savedMaterialId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-marigold/40 bg-marigold/10 px-3.5 py-2 text-xs text-marigold hover:bg-marigold/20 transition-colors">
                        <ChefHat size={12} /> Saved — open in Study Materials →
                      </Link>
                    ) : (
                      <button onClick={saveAsStudyMaterial} disabled={savingAsMaterial}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-board3 bg-board2 px-3.5 py-2 text-xs text-chalkdim hover:text-chalk hover:border-marigold/50 disabled:opacity-50 transition-colors">
                        {savingAsMaterial
                          ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                          : <><ChefHat size={12} /> Also save as Study Material</>}
                      </button>
                    )}
                    {saveMaterialError && <div className="mt-1.5 text-xs text-terracotta">{saveMaterialError}</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <div className="mt-3 text-sm text-terracotta">{error}</div>}
        </div>
      )}

      {/* ── LOADING ── */}
      {stage === "loading" && (
        <div className="flex items-center gap-2 py-10 font-display text-lg text-chalkdim">
          <Loader2 size={18} className="animate-spin" />
          {activeBook
            ? `Opening ${activeBook.name} to page ${bookPage}…`
            : tbMode
            ? "AI Guru is reading the textbook page…"
            : `Chalking up the lesson on ${topicLabel}…`}
        </div>
      )}

      {/* ── LESSON ── */}
      {stage === "lesson" && lesson && (
        <div>
          {/* Split view — a live open textbook (book class) or the static
              photographed page (one-off textbook mode) on the left */}
          <div className={`mb-4 ${(tbPreview || (activeBook && activeBookFile)) ? "grid gap-5 md:grid-cols-2 md:items-start" : ""}`}>

            {activeBook && activeBookFile ? (
              <div className="overflow-hidden rounded-xl border border-board3 bg-board2 md:sticky md:top-4">
                {/* The open page, with the teacher's spotlight beam */}
                <TextbookPageView
                  file={activeBookFile}
                  pageNumber={bookPage}
                  spotlight={activeSpotlight}
                />
                {/* Page-turn bar — Next continues the syllabus and saves
                    the resume pointer; Prev revises without losing it */}
                <div className="flex items-center gap-1 border-t border-board3 px-2 py-1.5">
                  <button
                    onClick={() => teachBookPage(activeBook, activeBookFile, bookPage - 1)}
                    disabled={bookPage <= 1 || stage !== "lesson"}
                    title="Revise the previous page"
                    className="rounded-lg border border-board3 bg-board p-1.5 text-chalkdim hover:text-chalk disabled:opacity-40 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <div className="flex-1 text-center font-mono text-[10px] uppercase tracking-wider text-chalkdim truncate px-1">
                    📖 {activeBook.name} — p.{bookPage}/{activeBook.totalPages}
                    {activeSpotlight ? " · 🔦" : ""}
                  </div>
                  <button
                    onClick={() => teachBookPage(activeBook, activeBookFile, bookPage + 1)}
                    disabled={bookPage >= activeBook.totalPages || stage !== "lesson"}
                    title="Teach the next page"
                    className="inline-flex items-center gap-1 rounded-lg border border-marigold/40 bg-marigold/10 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-marigold hover:bg-marigold/20 disabled:opacity-40 transition-colors">
                    Next page <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ) : tbPreview && (
              <div className="overflow-hidden rounded-xl border border-board3 bg-board2">
                <img src={tbPreview} alt="Textbook page" className="w-full block max-h-[520px] object-contain" />
                <div className="border-t border-board3 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-chalkdim">
                  📖 Textbook page{tbPageInfo ? ` — p.${tbPageInfo.page}` : ""}
                </div>
              </div>
            )}

            <Card>
              {/* Teacher avatar */}
              <div className="mb-4 flex items-center gap-3">
                <div className={lessonTyping ? "animate-pulse" : ""}>
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <circle cx="22" cy="14" r="8" stroke="#f4f1e8" strokeWidth="2.5" />
                    <path d="M8 40c1-10 6-16 14-16s13 6 14 16" stroke="#f4f1e8" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="19" cy="13" r="1.2" fill="#f4f1e8" />
                    <circle cx="25" cy="13" r="1.2" fill="#f4f1e8" />
                    <path d="M18 17q4 3 8 0" stroke="#f4f1e8" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="font-display text-base text-marigold">AI Guru</div>
                  <div className="font-mono text-[10px] text-chalkdim">
                    {lessonTyping ? "TEACHING NOW" : "CLASS COMPLETE"}
                  </div>
                </div>
              </div>

              <h2 className="font-display text-2xl text-chalk mb-3">{lesson.title}</h2>

              <ul className="mb-5 flex flex-col gap-1.5 list-none p-0">
                {pointLines.map((l, pi) => typedLine(l, (c, isActive) => (
                  <li key={l.id}
                    onClick={() => {
                      // Book class: tapping a taught point re-aims the
                      // spotlight at that point's source line on the page.
                      if (activeBook && lesson.spotlights?.[pi]) {
                        setManualSpot(m => (m === pi ? null : pi));
                      }
                    }}
                    className={`text-sm pl-4 relative -mx-2 px-2 py-1.5 rounded-lg before:content-['—'] before:absolute before:left-2 before:text-marigold transition-all duration-300 ${
                      isActive || manualSpot === pi
                        ? "bg-marigold/10 text-chalk shadow-[0_0_18px_rgba(232,163,61,0.15)]"
                        : "text-chalk/55"
                    } ${activeBook && lesson.spotlights?.[pi] ? "cursor-pointer hover:text-chalk" : ""}`}>
                    {c}
                    {activeBook && lesson.spotlights?.[pi] && (
                      <span className="ml-1.5 select-none" title="Spotlight this line in the book">🔦</span>
                    )}
                  </li>
                )))}
              </ul>

              {exStarted && lesson.example && (
                <div className="mb-4 rounded-lg border border-dashed border-board3 p-4">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-terracotta">
                    Worked example
                  </div>
                  {typedLine(exampleLines.find(l => l.section === "ex-problem"),
                    (c, isActive) => (
                      <div className={`mb-2 text-sm rounded-lg -mx-1.5 px-1.5 py-1 transition-all duration-300 ${
                        isActive ? "bg-marigold/10 shadow-[0_0_18px_rgba(232,163,61,0.15)]" : "opacity-55"
                      }`}>{c}</div>
                    ))}
                  <ol className="mb-2 list-decimal pl-5 text-sm text-chalkdim">
                    {exampleLines.filter(l => l.section === "ex-step")
                      .map(l => typedLine(l, (c, isActive) => (
                        <li key={l.id} className={`rounded transition-all duration-300 ${
                          isActive ? "text-chalk bg-marigold/10 -mx-1 px-1" : "opacity-55"
                        }`}>{c}</li>
                      )))}
                  </ol>
                  {typedLine(exampleLines.find(l => l.section === "ex-answer"),
                    (c, isActive) => (
                      <div className={`text-sm text-marigold rounded-lg -mx-1.5 px-1.5 py-1 transition-all duration-300 ${
                        isActive ? "bg-marigold/10 shadow-[0_0_18px_rgba(232,163,61,0.15)]" : "opacity-55"
                      }`}>Answer: {c}</div>
                    ))}
                </div>
              )}

              {exStarted && !!lesson.visual && (
                <div className="mb-4">
                  <DiagramRenderer visual={lesson.visual} />
                </div>
              )}

              {checkStarted && checkLine && (
                <div className="border-t border-board3 pt-3 text-sm text-chalkdim">
                  <b className="text-chalk">Check yourself — </b>
                  {typedLine(checkLine, c => <>{c}</>)}
                </div>
              )}
            </Card>
          </div>

          {!lessonTyping && (
            <div>
              <div className="mb-6">
                <Button variant="ghost" onClick={reset}>
                  <RotateCcw size={14} /> New topic
                </Button>
              </div>

              <div className="mb-3 flex items-center justify-between">
                <div className="font-display text-lg text-chalk">Ask AI Guru</div>
              </div>
              <div className="mb-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
                {thread.map((m, i) => (
                  <div key={i}
                    className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                      m.role === "student" ? "self-end bg-blue text-board" : "self-start bg-board3 text-chalk"
                    }`}>
                    <div className="font-mono text-[9px] opacity-60 mb-1">
                      {m.role === "student" ? "YOU" : "GANIT GURU"}
                    </div>
                    {m.role === "teacher" && !typedMsgIds.has(i) ? (
                      <Typewriter text={m.text} speed={speedMs}
                        onDone={() => setTypedMsgIds(p => new Set(p).add(i))} />
                    ) : m.text}
                  </div>
                ))}
                {qaLoading && (
                  <div className="self-start bg-board3 rounded-lg px-3.5 py-2.5">
                    <Loader2 size={14} className="animate-spin text-chalkdim" />
                  </div>
                )}
                <div ref={threadEndRef} />
              </div>

              {/* Attached photo chip — shown above the composer until sent */}
              {qaPhotoPreview && (
                <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-marigold/40 bg-board2 px-2 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qaPhotoPreview} alt="Photo of your problem"
                    className="h-10 w-10 rounded object-cover border border-board3" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-marigold">
                    Photo attached
                  </span>
                  <button onClick={clearQaPhoto} title="Remove photo"
                    className="rounded p-1 text-chalkdim hover:text-terracotta hover:bg-board3 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                {/* Camera — snap the textbook problem; capture="environment"
                    opens the back camera directly on Android */}
                <input ref={qaCamRef} type="file" accept="image/*" capture="environment"
                  className="hidden"
                  onChange={e => { attachQaPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                <button onClick={() => qaCamRef.current?.click()} disabled={qaLoading}
                  title="Snap a photo of the problem"
                  className={`shrink-0 rounded-lg border px-3 py-2.5 transition-colors disabled:opacity-50 ${
                    qaPhoto
                      ? "border-marigold bg-marigold/15 text-marigold"
                      : "border-board3 bg-board2 text-chalkdim hover:text-marigold hover:border-marigold/50"
                  }`}>
                  <Camera size={16} />
                </button>

                {/* Mic — dictate the question in the student's own language */}
                {qaMic.supported && (
                  <button onClick={qaMic.toggle} disabled={qaLoading}
                    title={qaMic.listening ? "Stop listening" : "Speak your question"}
                    className={`shrink-0 rounded-lg border px-3 py-2.5 transition-colors disabled:opacity-50 ${
                      qaMic.listening
                        ? "border-terracotta bg-terracotta/20 text-terracotta animate-pulse"
                        : "border-board3 bg-board2 text-chalkdim hover:text-chalk hover:bg-board3"
                    }`}>
                    <Mic size={16} />
                  </button>
                )}

                <input
                  className="flex-1 rounded-lg border border-board3 bg-board2 px-3.5 py-2.5 text-sm text-chalk placeholder:text-chalkdim/60"
                  placeholder={qaMic.listening ? "Listening… speak now" : "Type, speak, or snap a follow-up question…"}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && askQuestion()} />
                <Button onClick={askQuestion} disabled={(!question.trim() && !qaPhoto) || qaLoading}>
                  <Send size={14} /> Ask
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default function ClassroomPage() {
  return (
    <Suspense fallback={null}>
      <ClassroomInner />
    </Suspense>
  );
}
