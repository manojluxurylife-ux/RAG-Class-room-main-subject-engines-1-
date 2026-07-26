"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Upload, Play, Pause, ChevronLeft, ChevronRight, Send, Layers,
  HelpCircle, MessageCircleQuestion, MousePointer2, Pencil, Highlighter,
  Eraser, Undo2, Redo2, Trash2, Type, Shapes, ZoomIn, ZoomOut, Bookmark,
  Bell, Moon, Sun, Globe, LogOut, StickyNote, Presentation, Map as MapIcon,
  NotebookText, BookOpen, PenSquare, X,
} from "lucide-react";
import { extractPageText } from "@/lib/client/pdf-text";
import { textbookContext } from "@/lib/textbook-context";
import { classroomProgress } from "@/lib/classroom-progress";
import { pendingDoubt } from "@/lib/pending-doubt";
import { savePdf, getPdfUrl, getPdfFile, deletePdf } from "@/lib/client/pdf-store";
import { renderPdfPagesToDataUrls } from "@/lib/client/pdf-page";
import { isDriveConfigured, requestStudentDriveAccess, uploadToStudentDrive } from "@/lib/student-drive";
import { fetchGrounding } from "@/lib/client-material-generation";
import { generateWithSelectedAI, compactTextbookContext } from "@/lib/client-ai-router";
import { studentSession } from "@/lib/student-session";
import { restoreStudentSession } from "@/lib/client/restore-student-session";
import { safeStringify } from "@/lib/safe-storage";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { getSpeechLang, loadSpeechVoices, selectFemaleVoice, primeSpeechEngine, speakChunked, hasVoiceFor, minDisplayDurationMs, type ChunkedSpeechHandle } from "@/lib/web-speech";
import { callGeminiTtsClient } from "@/lib/student-key";
import { decodeBytes, decodeAudioData } from "@/lib/gemini-live";
import { getCachedTtsAudio, setCachedTtsAudio, hashCacheKey } from "@/lib/client/tts-cache";
import { teachingLanguageInstruction, type TeachingStyle } from "@/lib/language-preferences";
import { RagClassroomSidebar } from "@/components/RagClassroomSidebar";
import { deleteOfflineMaterial, listOfflineMaterials } from "@/lib/offline-materials";
import { buildPreparedTeachingPack } from "@/lib/prepared-teaching-pack";
import { DrawableCanvas, type DrawTool, type DrawableCanvasHandle } from "@/components/DrawableCanvas";
import { TextbookPageView } from "@/components/TextbookPageView";
import { DiagramRenderer } from "@/components/visuals/DiagramRenderer";
import { findSceneIndexForPage as findSceneIndexForPageImpl } from "@/lib/scene-page-sync";
import {
  defaultPanelLayout, clampRectToCanvas, bringToFront,
  loadPanelLayout, savePanelLayout, resetPanelLayout,
  type PanelLayout, type PanelRect,
} from "@/lib/client/panel-layout";
import { FloatingPanel } from "@/components/FloatingPanel";
import { normalizeWhiteboardPlan } from "@/lib/whiteboard-commands";
import { hasValidSession, redirectToLogin, isSessionExpiredResponse } from "@/lib/client/verify-session";
import { PptSlideDeck } from "@/components/materials/PptSlideDeck";
import { McqQuizDeck } from "@/components/materials/McqQuizDeck";

const WhiteboardCommandEngine = dynamic(() => import("@/components/WhiteboardCommandEngine"), { ssr: false });

type Doc = { id: string; name: string; pages: number; chunks: number; subject?: string; grade?: string; syllabus?: string; sourceLanguage?: string; learningLanguage?: string };
type ChapterQuestion = { id: string; question: string; options: string[]; correctIndex: number; explanation?: string; bloomsLevel?: string };
type Scene = { type: string; phase?: "read" | "explain" | "solve" | "unit"; title: string; narration: string; narrationLanguage?: string; sourceLanguage?: string; sourceNarration?: string; explanationNarration?: string; solveNarration?: string; board: string[]; question: string; sourcePage?: number; sourceIds?: string[]; spotlight?: string; visual?: unknown; whiteboardCommands?: unknown; chapterEnd?: boolean; chapterId?: string; chapterTitle?: string; chapterQuestions?: ChapterQuestion[]; paragraphUnits?: { source: string; explanation: string; solve: string }[] };

type CenterTab = "teacher" | "doubts" | "notes" | "summary";
type ThreadMsg = { role: "student" | "ai"; text: string };

// materialType values match the `specs` keys in
// app/api/material-studio/generate/route.ts. There is no dedicated
// "worksheet" or "mind map" spec in that route yet, so those two cards
// use the closest existing spec (web_lesson / knowledge_base) — noted
// honestly rather than silently invented.
const MATERIAL_CARDS = [
  { key: "notes", label: "Smart Notes", materialType: "memory", icon: StickyNote },
  { key: "ppt", label: "PPT Slides", materialType: "ppt", icon: Presentation },
  { key: "quiz", label: "MCQ Quiz", materialType: "quiz_bank", icon: HelpCircle },
  { key: "flashcards", label: "Flashcards", materialType: "flashcards", icon: Layers },
  { key: "worksheet", label: "Worksheet", materialType: "personalized", icon: NotebookText },
  { key: "mindmap", label: "Mind Map", materialType: "knowledge_base", icon: MapIcon },
  { key: "book", label: "Interactive Book", materialType: "interactive_book", icon: BookOpen },
  { key: "revision", label: "Revision Notes", materialType: "revision_notes", icon: StickyNote },
  { key: "lessonplan", label: "Lesson Plan", materialType: "classroom", icon: Presentation },
  { key: "script", label: "Teaching Script", materialType: "discussion", icon: MessageCircleQuestion },
  { key: "boardcommands", label: "Whiteboard Commands", materialType: "whiteboard", icon: PenSquare },
] as const;

const UI_STRINGS: Record<string, Record<string, string>> = {
  english: { liveClass: "Live Class", endClass: "End Class", textSize: "Text Size", boardStyle: "Board Style", teachingStyle: "Teaching Style" },
  malayalam: { liveClass: "തത്സമയ ക്ലാസ്", endClass: "ക്ലാസ് അവസാനിപ്പിക്കുക", textSize: "ടെക്സ്റ്റ് വലുപ്പം", boardStyle: "ബോർഡ് ശൈലി", teachingStyle: "അധ്യാപന ശൈലി" },
  hindi: { liveClass: "लाइव क्लास", endClass: "क्लास समाप्त करें", textSize: "टेक्स्ट आकार", boardStyle: "बोर्ड शैली", teachingStyle: "शिक्षण शैली" },
};
// Any language not in UI_STRINGS honestly falls back to English chrome
// text rather than showing untranslated placeholders.
function t(lang: string, key: string): string {
  return UI_STRINGS[lang]?.[key] || UI_STRINGS.english[key] || key;
}

export default function RagClassroom() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [doc, setDoc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadSubject, setUploadSubject] = useState("");
  const [uploadGrade, setUploadGrade] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  // Separate from `status` (a small, easy-to-miss dim text line) —
  // this drives a prominent, dismissible banner shown BEFORE a class
  // starts if the teaching language has no voice on this device, so
  // the student knows upfront why narration will be silent instead of
  // discovering it scene-by-scene mid-class with no clear explanation.
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [lesson, setLesson] = useState<any>(null);

  const sanitize = (obj: any, visited = new WeakSet()): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (visited.has(obj)) return "[Circular]";
    visited.add(obj);
    if (Array.isArray(obj)) return obj.map(o => sanitize(o, visited));
    const newObj: any = {};
    for (const key in obj) {
      const value = obj[key];
      // Omit React elements
      if (value && typeof value === 'object' && value.$$typeof && typeof value.$$typeof === 'symbol') continue;
      // Omit DOM nodes
      if (value && typeof value === 'object' && value.nodeType && typeof value.nodeType === 'number') continue;
      // Recursively sanitize
      newObj[key] = sanitize(value, visited);
    }
    return newObj;
  };

  const setLessonSafe = (newLesson: any) => {
    setLesson(sanitize(newLesson));
  };
  const [scene, setScene] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [classStarted, setClassStarted] = useState(false);
  const [chapterTest, setChapterTest] = useState<{ sceneIndex: number; chapterId: string; chapterTitle: string; questions: ChapterQuestion[] } | null>(null);
  const [chapterAnswers, setChapterAnswers] = useState<Record<string, number>>({});
  const [chapterResult, setChapterResult] = useState<{ score: number; total: number; percentage: number; passed: boolean } | null>(null);
  const [teachingSpeed, setTeachingSpeed] = useState(0.85);
  const playbackRunRef = useRef(0);
  const [boardPlaying, setBoardPlaying] = useState(true);
  const [boardSyncToken, setBoardSyncToken] = useState(0);
  // Free drag-and-drop repositioning for the three main panels
  // (textbook, notes, whiteboard). Deliberately only enabled above a
  // width threshold — free-floating windows are a genuinely poor fit
  // for the small touchscreens this app targets; below the threshold
  // this falls straight through to the original, proven static grid
  // layout (see FloatingPanel's floatingEnabled=false path), not a
  // worse or disabled version of the new one.
  const FLOATING_MIN_WIDTH = 1024;
  const [panelCanvasSize, setPanelCanvasSize] = useState({ w: 1200, h: 700 });
  const [floatingEnabled, setFloatingEnabled] = useState(false);
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(() => defaultPanelLayout({ w: 1200, h: 700 }));
  const panelCanvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function measure() {
      setFloatingEnabled(window.innerWidth >= FLOATING_MIN_WIDTH);
      const el = panelCanvasRef.current;
      const w = el?.clientWidth || Math.min(1400, window.innerWidth - 48);
      const h = Math.max(560, window.innerHeight - 260);
      setPanelCanvasSize({ w, h });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const saved = loadPanelLayout();
    setPanelLayout(saved && saved.textbook && saved.notes && saved.whiteboard ? saved : defaultPanelLayout(panelCanvasSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePanelRect = useCallback((id: string, rect: PanelRect) => {
    setPanelLayout(prev => ({ ...prev, [id]: rect }));
  }, []);

  // Debounced persistence — a drag fires updatePanelRect on every
  // pointermove (potentially dozens of times a second); writing to
  // localStorage that often would be wasteful for no benefit, since
  // only the FINAL position after the student lets go actually matters.
  useEffect(() => {
    const timer = window.setTimeout(() => savePanelLayout(panelLayout), 400);
    return () => window.clearTimeout(timer);
  }, [panelLayout]);

  const focusPanel = useCallback((id: string) => {
    setPanelLayout(prev => bringToFront(prev, id));
  }, []);

  function resetPanels() {
    resetPanelLayout();
    setPanelLayout(defaultPanelLayout(panelCanvasSize));
  }
  // Which paragraph unit (see lib/paragraph-units.ts) is currently
  // playing within the active scene — drives the on-screen split view
  // (English source above, Malayalam explanation below) so the text a
  // student sees follows the SAME paragraph the audio is currently on,
  // instead of showing the whole scene's text as one static block
  // while narration progresses through it underneath.
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<ThreadMsg[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [notes, setNotes] = useState<any>(null);
  const notesLoading = false;
  const [centerTab, setCenterTab] = useState<CenterTab>("teacher");
  const [selectedText, setSelectedText] = useState("");
  const [driveStatus, setDriveStatus] = useState<Record<string, string>>({});
  const [sourceLanguage, setSourceLanguage] = useState("english");
  const [teachingLanguage, setTeachingLanguage] = useState("malayalam");
  const [materialLanguage, setMaterialLanguage] = useState("english");
  const [teachingStyle, setTeachingStyle] = useState<TeachingStyle>("target_with_english_terms");

  // Bottom "Study Materials Created" strip.
  const [materials, setMaterials] = useState<Record<string, { data?: any; loading?: boolean; error?: string; recordId?: string }>>({});
  const [selectedMaterialLabel, setSelectedMaterialLabel] = useState("");
  const [selectedMaterialKey, setSelectedMaterialKey] = useState("");

  // Header chrome.
  const [uiLanguage, setUiLanguage] = useState("english");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Control row: annotation tools + display prefs.
  const [tbTool, setTbTool] = useState<"pointer" | "pen" | "highlighter" | "eraser">("pointer");
  const [tbColor] = useState("#ef4444");
  const [textSize, setTextSize] = useState(100);
  const [boardStyle, setBoardStyle] = useState<"handwriting" | "print">("handwriting");

  // AI Whiteboard's own toolbar.
  const [bwTool, setBwTool] = useState<DrawTool>("select");
  const [bwColor, setBwColor] = useState("#111111");
  const [bwHistory, setBwHistory] = useState({ canUndo: false, canRedo: false });
  const bwCanvasRef = useRef<DrawableCanvasHandle>(null);
  const tbCanvasRef = useRef<DrawableCanvasHandle>(null);

  // Textbook page viewer state.
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [bookmarked, setBookmarked] = useState(false);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});

  useEffect(() => {
    async function initSession() {
      const p = await restoreStudentSession();
      if (!p) {
        router.push("/login");
        return;
      }
      setProfile(p);
      setSourceLanguage(p.sourceLanguage || "english");
      setTeachingLanguage(p.teachingLanguage || p.languageId || "malayalam");
      setMaterialLanguage(p.materialLanguage || "english");
      setTeachingStyle(p.teachingStyle || "target_with_english_terms");
      setMounted(true);

      const savedTheme = localStorage.getItem("ai-guru-theme") as "dark" | "light" | null;
      if (savedTheme) setTheme(savedTheme);

      // Offline or network error, proceed
      refresh();
    }
    initSession();
  }, []);

  useEffect(() => {
    localStorage.setItem("ai-guru-theme", theme);
  }, [theme]);

  const groups = docs.reduce<Record<string, Doc[]>>((acc, d) => { const key = d.subject || d.name.replace(/\.pdf$/i, "") || "Textbook"; (acc[key] = acc[key] || []).push(d); return acc; }, {});

  async function refresh(preferredId?: string) {
    const response = await fetch("/api/rag/ingest", { cache: "no-store" });
    const payload = await response.json();
    const nextDocs = payload.documents || [];
    setDocs(nextDocs);
    const targetId = preferredId || doc || nextDocs[0]?.id;
    if (targetId && targetId !== doc) await selectDoc(targetId);
  }

  async function upload() {
    if (!file) return;
    setBusy(true); setStatus("Extracting PDF text…");
    try {
      const pdf = await import("pdfjs-dist");
      pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const ab = await file.arrayBuffer();
      const d = await pdf.getDocument({ data: ab }).promise;
      let pages: { page: number; text: string }[] = [];
      for (let p = 1; p <= d.numPages; p++) { setStatus(`Reading page ${p} of ${d.numPages}…`); pages.push({ page: p, text: await extractPageText(file, p) }); }
      const readableChars = pages.reduce((n, p) => n + p.text.trim().length, 0);
      if (readableChars < Math.max(80, d.numPages * 20)) {
        setStatus("Scanned PDF detected — running OCR…");
        const fd = new FormData(); fd.append("file", file);
        const or = await fetch("/api/rag/ocr", { method: "POST", body: fd });
        const ox = await or.json(); if (!or.ok) throw Error(ox.error || "OCR failed");
        pages = ox.pages;
      }
      const r = await fetch("/api/rag/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, pages, subject: uploadSubject, grade: uploadGrade }) });
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      setStatus(`Indexed ${x.document.chunks} textbook chunks. ${x.mathNormalization?.message || ""}`.trim());
      try { await savePdf(x.document.id, file); } catch { }
      setFile(null); setUploadSubject(""); setUploadGrade("");
      await refresh(x.document.id);
    } catch (e: any) { setStatus(e.message); } finally { setBusy(false); }
  }

  async function selectDoc(id: string) {
    const selectedDoc = docs.find(item => item.id === id);
    if (selectedDoc?.sourceLanguage) setSourceLanguage(selectedDoc.sourceLanguage);
    if (selectedDoc?.learningLanguage) {
      setTeachingLanguage(selectedDoc.learningLanguage);
      setMaterialLanguage(selectedDoc.learningLanguage);
      setTeachingStyle("target_with_english_terms");
      studentSession.update({ teachingLanguage: selectedDoc.learningLanguage, teachingStyle: "target_with_english_terms" });
    }
    setDoc(id);
    setLessonSafe(null); setScene(0); setCenterTab("teacher"); setMaterials({}); setNotes(null); setSelectedMaterialLabel(""); setSelectedMaterialKey("");
    setThread([]); setSources([]); setQuestion(""); setSelectedText(""); setPageNum(1); setThumbs({});
    const allSavedMaterials = await listOfflineMaterials().catch(() => []);
    const created = allSavedMaterials.filter(item => item.documentId === id);
    const restored: Record<string, { data?: any; recordId?: string }> = {};
    for (const card of MATERIAL_CARDS) {
      const match = created.find(item => item.materialType === card.materialType);
      if (match) restored[card.key] = { data: match.data, recordId: match.id };
    }
    setMaterials(restored);
    const progress = classroomProgress.get(id);
    setTopic(progress?.topic || "");
    setPageNum(Math.max(1,Number(progress?.page||1)));
    const expectedLanguage = selectedDoc?.learningLanguage || teachingLanguage;
    const prepared = buildPreparedTeachingPack(created, {
      documentId: id,
      grade: selectedDoc?.grade || profile?.grade || undefined,
      sourceLanguage: selectedDoc?.sourceLanguage || sourceLanguage,
      teachingLanguage: expectedLanguage,
      materialLanguage: expectedLanguage,
    });
    const resumable = progress?.lesson?.preparedOffline === true && progress.lesson.lessonWorkflowVersion === "prepared-browser-v3-synchronized-units" && progress.lesson.documentId === id && progress.lesson.languagePreferences?.teachingLanguage === expectedLanguage;
    if (resumable) {
      setLessonSafe(progress!.lesson); setScene(Math.min(Number(progress?.scene || 0), Math.max(0, progress!.lesson.scenes.length - 1)));
      setStatus("Prepared class restored. The browser will teach it without generating a new lesson.");
    } else if (prepared) {
      setLessonSafe(prepared); setScene(0); setTopic(prepared.title);
      classroomProgress.set(id, { topic: prepared.title, scene: 0, page: prepared.scenes[0]?.sourcePage || 1, lesson: prepared });
      setStatus(`Prepared study pack loaded · ${prepared.scenes.length} browser-taught scenes · AI is reserved for live doubts.`);
    } else {
      setLessonSafe(null); setScene(0);
      setStatus("No prepared teaching pack exists for this textbook. Create Study Materials in Material Studio first.");
    }
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    const url = await getPdfUrl(id).catch(() => null);
    setPdfUrl(url);
    const f = await getPdfFile(id).catch(() => null);
    setPdfFile(f);
    setBookmarked(typeof window !== "undefined" && localStorage.getItem(`ai-guru-bookmark-${id}`) === "1");
    if (progress?.topic) {
      const d = docs.find(d => d.id === id);
      textbookContext.set({ documentId: id, documentName: d?.name || "Indexed textbook", topic: progress.topic });
    }
  }

  async function confirmDeleteTextbook(documentId: string) {
    const textbook = docs.find(item => item.id === documentId);
    if (!textbook) return;
    const label = textbook.subject || textbook.name.replace(/\.pdf$/i, "");
    const confirmed = window.confirm(`Do you want to delete “${label}”?\n\nIts uploaded PDF, indexed textbook data, classroom progress, and all study materials created from it will be deleted together. This action cannot be undone.`);
    if (!confirmed) return;
    setBusy(true); setStatus(`Deleting ${label}…`);
    try {
      const response = await fetch(`/api/rag/ingest?id=${encodeURIComponent(documentId)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Delete failed");
      const savedMaterials = await listOfflineMaterials().catch(() => []);
      await Promise.all(savedMaterials.filter(item => item.documentId === documentId).map(item => deleteOfflineMaterial(item.id)));
      await deletePdf(documentId).catch(() => {});
      classroomProgress.remove(documentId);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const remaining = docs.filter(item => item.id !== documentId);
      setDocs(remaining); setMaterials({}); setNotes(null); setLessonSafe(null); setSelectedMaterialLabel(""); setSelectedMaterialKey(""); setScene(0); setPageNum(1); setPdfUrl(null); setPdfFile(null); setThumbs({});
      if (remaining.length) await selectDoc(remaining[0].id); else setDoc("");
      setStatus(`${label} and its study materials were deleted.`);
    } catch (error: any) {
      setStatus(`Could not delete ${label}: ${error?.message || "please try again."}`);
    } finally { setBusy(false); }
  }

  async function createLesson(autoStart = false) {
    setBusy(true); setStatus("Loading the prepared teaching pack…");
    try {
      const selectedTextbook=docs.find(item=>item.id===doc);
      const records=(await listOfflineMaterials()).filter(item=>item.documentId===doc);
      const prepared=buildPreparedTeachingPack(records,{documentId:doc,grade:selectedTextbook?.grade||profile?.grade||undefined,sourceLanguage,teachingLanguage,materialLanguage});
      if(!prepared?.scenes?.length)throw new Error("Create this textbook's study materials in Material Studio before starting the class");
      setTopic(prepared.title);
      setLessonSafe(prepared); setScene(0); setStatus(`Prepared pack loaded · ${prepared.scenes.length} scenes. No live AI generation is needed.`);
      const docName = docs.find(d => d.id === doc)?.name || "Indexed textbook";
      textbookContext.set({ documentId: doc, documentName: docName, topic:prepared.title });
      if (autoStart && prepared.scenes[0]) {
        setClassStarted(true);
        const runId=++playbackRunRef.current;
        playSceneAt(0,prepared,runId);
      }
      classroomProgress.set(doc, { topic:prepared.title, scene: 0, page:prepared.scenes[0]?.sourcePage||1, lesson: prepared });
    } catch (e: any) { if(autoStart)setClassStarted(false);setSpeaking(false);setBoardPlaying(false);setStatus(`Could not start the prepared class: ${e.message || "prepared materials were not found"}.`); }
    setBusy(false);
  }

  function changeTeachingLanguage(value: string) {
    playbackRunRef.current++;
    window.speechSynthesis.cancel(); stopNarrationAudio();
    setSpeaking(false); setClassStarted(false);
    setTeachingLanguage(value);
    setTeachingStyle("target_with_english_terms");
    setVoiceWarning(null); // was for the previous language; startClass() re-checks fresh
    studentSession.update({ teachingLanguage: value, teachingStyle: "target_with_english_terms" });
    setLessonSafe(null); setScene(0);
    if (doc) classroomProgress.set(doc, { lesson: null, scene: 0 });
    setStatus(`${SUPPORTED_LANGUAGES.find(item => item.id === value)?.label || value} selected. Start Class will load the saved teaching pack in this language. Recreate the pack in Material Studio if it was prepared in another language.`);
  }

  useEffect(() => { setBoardPlaying(false); setBoardSyncToken(x => x + 1); setActiveUnitIndex(0); const active=lesson?.scenes?.[scene] as Scene|undefined;if(active?.sourcePage)setPageNum(Math.max(1,Number(active.sourcePage))); }, [scene, lesson]);
  useEffect(() => () => { playbackRunRef.current++; window.speechSynthesis.cancel(); stopNarrationAudio(); }, []);
  function syncScene(next:number,activeLesson:any=lesson){const active=activeLesson?.scenes?.[next] as Scene|undefined;setScene(next);if(active?.sourcePage)setPageNum(Math.max(1,Number(active.sourcePage)));if(doc)classroomProgress.set(doc,{scene:next,page:active?.sourcePage});}
  const chunkedSpeechRef = useRef<ChunkedSpeechHandle | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const geminiSourceRef = useRef<AudioBufferSourceNode | null>(null);
  function stopNarrationAudio(){
    chunkedSpeechRef.current?.cancel(); chunkedSpeechRef.current = null;
    if (geminiSourceRef.current) { try { geminiSourceRef.current.onended = null; geminiSourceRef.current.stop(); } catch {} geminiSourceRef.current = null; }
  }
  /** The one female-presenting voice used for every local-language step
   *  in the classroom (explain + whiteboard-solve). Google's own docs
   *  describe Gemini's 30 prebuilt voices by TONE (bright, upbeat,
   *  firm...), not by an explicit gender label — "Kore" is the voice
   *  most consistently used as the female-presenting option across
   *  Google's own paired multi-speaker examples, so it's the
   *  best-effort choice here, not an official gender designation.
   *  Kept as one named constant, not buried in logic, specifically so
   *  it's trivial to try a different voice name later if this one
   *  doesn't sound right on real classroom content. */
  const GEMINI_TEACHER_VOICE = "Kore";
  /** Plays `text` using a real Gemini-generated audio clip (cached by
   *  exact text in IndexedDB) instead of the browser's speechSynthesis.
   *  Returns true if playback actually started (caller should NOT also
   *  run the browser-speech fallback); returns false / throws on any
   *  failure so the caller falls through to that fallback instead. */
  async function tryGeminiVoice(text: string, onDone: () => void): Promise<boolean> {
    if (typeof window === "undefined" || !("AudioContext" in window || "webkitAudioContext" in window)) return false;
    const cacheKey = hashCacheKey(text, GEMINI_TEACHER_VOICE);

    let pcmBytes: Uint8Array | null = null;
    try { pcmBytes = await getCachedTtsAudio(cacheKey); } catch { /* cache miss/unavailable — fall through to generating */ }

    if (!pcmBytes) {
      const locale = getSpeechLang(teachingLanguage);
      const { data } = await callGeminiTtsClient(text, locale);
      pcmBytes = decodeBytes(data);
      // Fire-and-forget: today's narration must not wait on the cache
      // WRITE completing — only on Gemini's response, which already
      // happened by this point.
      void setCachedTtsAudio(cacheKey, pcmBytes).catch(() => {});
    }

    const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextCtor();
    const ctx = audioCtxRef.current!;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const buffer = await decodeAudioData(pcmBytes, ctx);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    geminiSourceRef.current = source;
    source.onended = () => { if (geminiSourceRef.current === source) geminiSourceRef.current = null; onDone(); };
    source.start();
    return true;
  }

  // A SEPARATE audio source ref from geminiSourceRef/tryGeminiVoice
  // above — that one belongs to the block-narration state machine
  // (speaking/boardPlaying, awaited via onComplete). This one is for
  // the whiteboard's own per-line narration (see toNarratedSegments in
  // lib/whiteboard-commands.ts): WhiteboardCommandEngine paces itself
  // off each command's own durationMs, not off when speech finishes,
  // so this is deliberately fire-and-forget rather than
  // narrate()-shaped. Kept isolated so a line's audio can be stopped
  // cleanly (see below) without touching an unrelated in-flight
  // narrate() call, and vice versa.
  const boardLineSourceRef = useRef<AudioBufferSourceNode | null>(null);
  // Holds "what to do once the whiteboard finishes playing its current
  // scene's commands" — set right before starting a combined explain-
  // while-write pass (see playSceneAt below) and read by the
  // <WhiteboardCommandEngine onComplete=...> wiring in the JSX, since
  // that JSX lives outside playSceneAt's own closure.
  const boardCompleteRef = useRef<() => void>(() => {});

  /** Speaks ONE whiteboard line while it's being written — the
   *  "explain while writing" behaviour, replacing the old design where
   *  a whole paragraph's explanation played as one flat block, fully
   *  separate from a differently-timed whiteboard animation. Stops
   *  whatever board line was still playing first, since the engine
   *  advances to the next command on its own visual clock rather than
   *  waiting for speech to finish — an overrunning line's audio should
   *  cut off cleanly for the next one rather than overlap it. Falls
   *  back to browser speech the same way narrate() does if Gemini
   *  fails for any reason (no key, network, quota) — the board never
   *  goes fully silent just because a line's TTS call didn't work. */
  async function speakBoardLine(text: string, language: string) {
    if (!text.trim()) return;
    if (boardLineSourceRef.current) { try { boardLineSourceRef.current.onended = null; boardLineSourceRef.current.stop(); } catch {} boardLineSourceRef.current = null; }
    try {
      const cacheKey = hashCacheKey(text, GEMINI_TEACHER_VOICE);
      let pcmBytes: Uint8Array | null = null;
      try { pcmBytes = await getCachedTtsAudio(cacheKey); } catch {}
      if (!pcmBytes) {
        const { data } = await callGeminiTtsClient(text, getSpeechLang(language));
        pcmBytes = decodeBytes(data);
        void setCachedTtsAudio(cacheKey, pcmBytes).catch(() => {});
      }
      const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContextCtor();
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      const buffer = await decodeAudioData(pcmBytes, ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      boardLineSourceRef.current = source;
      source.onended = () => { if (boardLineSourceRef.current === source) boardLineSourceRef.current = null; };
      source.start();
    } catch {
      // Gemini unavailable for this line — browser speech, fire-and-
      // forget, same voice-selection helpers narrate() uses.
      if (!("speechSynthesis" in window)) return;
      try {
        const locale = getSpeechLang(language);
        const voices = await loadSpeechVoices();
        const voice = selectFemaleVoice(voices, locale);
        if (!voice) return;
        window.speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(text), { voice, lang: locale }));
      } catch {}
    }
  }

  async function narrate(text: string,onComplete?:()=>void,narrationLanguage=teachingLanguage,playWhiteboard=true,useGeminiVoice=false) {
    // NOTE: this deliberately does NOT bump boardSyncToken here anymore.
    // It used to (`if (playWhiteboard) setBoardSyncToken(x => x + 1)`),
    // which reset-and-replayed the ENTIRE whiteboard from a blank
    // canvas every time a "solve" step ran — and with paragraph-unit
    // playback, that's once per PARAGRAPH, not once per page. The
    // board would finish drawing during paragraph 1's solve step, then
    // visibly wipe itself and restart the same full-page animation
    // from scratch on paragraph 2's solve step, and again on 3, 4...
    // The actual "this is a new page, start the board fresh" reset
    // already happens correctly and exactly once per page via the
    // scene-change effect above (`setBoardSyncToken(x => x + 1)` there,
    // keyed on [scene, lesson]) — this function only needs to toggle
    // whether the board is actively animating right now, not force a
    // fresh replay every time.
    stopNarrationAudio(); setBoardPlaying(playWhiteboard); setSpeaking(true);
    let finished=false; let watchdog=0;
    const finish=()=>{if(finished)return;finished=true;if(watchdog)window.clearTimeout(watchdog);setSpeaking(false);setBoardPlaying(false);stopNarrationAudio();onComplete?.();};
    // Minimum time this step stays on screen even with NO audio at all.
    // WHY: previously, when a device had no voice for the teaching
    // language (very common for Malayalam/regional languages on budget
    // Android — the voice pack often isn't pre-installed), finish() fired
    // synchronously, in under a millisecond. The whiteboard's play window
    // (set above) only lasts as long as that near-zero gap, so it never
    // got real time to animate — and since the "explain"/"solve" steps
    // carry the actual teaching content in the student's chosen language,
    // this is exactly why "Malayalam is not speaking" AND "whiteboard is
    // not using" were both true at once: both were being skipped in under
    // a millisecond, not genuinely playing and finishing quickly. Reuses
    // the same text-length/speed heuristic as the watchdog below.
    const minDisplayMs = minDisplayDurationMs(text.length, teachingSpeed);
    const minDisplayDeadline = Date.now() + minDisplayMs;
    const finishAfterMinDisplay = () => {
      const remaining = minDisplayDeadline - Date.now();
      if (remaining > 0) window.setTimeout(finish, remaining); else finish();
    };
    if (!text.trim()) { finishAfterMinDisplay(); return; }

    // Gemini-generated voice for local-language steps (explain + the
    // whiteboard-solve step) — the browser still reads the ORIGINAL
    // textbook page itself (useGeminiVoice is only ever passed true by
    // callers narrating in the teaching language, never the source
    // reading). This exists specifically because a reliable local-
    // language voice often isn't installed on the device at all (see
    // the fallback below, which used to be the ONLY option) — a real
    // Gemini-generated clip works regardless of what's installed
    // locally, with one fixed teacher voice (GEMINI_TEACHER_VOICE)
    // every time, in every language. Cached in IndexedDB by exact text
    // (lib/client/tts-cache.ts) so the SAME paragraph is only ever
    // sent to Gemini once, then replayed instantly forever after —
    // matching this app's "prepared once, replayed forever" design.
    // Any failure here (no Gemini key connected, network error, quota
    // exhausted even after key rotation, decode failure) falls straight
    // through to the exact same browser-speech path used for the
    // source-reading step — a local-language class never goes fully
    // silent just because Gemini was unreachable.
    if (useGeminiVoice) {
      try {
        const played = await tryGeminiVoice(text, finish);
        if (played) return;
      } catch { /* fall through to browser speech below */ }
    }

    // WHY THE TRY/CATCH BELOW: everything from here down used to have
    // no error handling at all. Every single teaching step in the
    // whole class — every paragraph read, every explanation, the
    // combined explain-while-write pass — funnels through this one
    // function, chained via onComplete callbacks rather than a loop a
    // student could nudge forward again. If ANYTHING in this fallback
    // path threw (loadSpeechVoices() rejecting, speakChunked() hitting
    // one of the various known Android/Chrome speechSynthesis quirks,
    // literally any unexpected error) — finish() never got called,
    // onComplete never fired, and the ENTIRE REST OF THE CLASS silently
    // froze with no error shown and no way to recover except pausing
    // and restarting from a different point. This is very likely what
    // "breaking occasionally" actually was: not a total failure, but
    // one single narration step out of dozens per lesson hitting a
    // rare error with nothing catching it. Now, whatever goes wrong
    // here, the class still moves on to the next step instead of
    // stopping dead.
    try {
      if (!("speechSynthesis" in window)) { setStatus("This browser has no speech voice. Continuing the visual lesson."); finishAfterMinDisplay(); return; }
      // Instant after the first load — the voice list is cached module-wide,
      // so scene changes no longer stall on the voiceschanged timeout.
      const locale=getSpeechLang(narrationLanguage); const voices=await loadSpeechVoices();
      const localVoice=selectFemaleVoice(voices,locale);
      if (!localVoice) {
        const langLabel = SUPPORTED_LANGUAGES.find(item=>item.id===narrationLanguage)?.label||narrationLanguage;
        setStatus(`No ${langLabel} voice found on this device — teaching silently with the whiteboard and text. Install a ${langLabel} voice in your phone's Settings → Language → Text-to-speech for narration.`);
        finishAfterMinDisplay(); return;
      }
      // Chunked speech: the short first sentence starts almost instantly,
      // remaining chunks chain seamlessly; also sidesteps Chrome's known
      // long-utterance stall. The watchdog stays as the last safety net.
      watchdog=window.setTimeout(finish,Math.min(180000,Math.max(15000,(text.length*90)/Math.max(teachingSpeed,0.5))));
      chunkedSpeechRef.current = speakChunked({ text, locale, voice: localVoice, rate: teachingSpeed, onDone: finish });
    } catch (e) {
      console.error("[narrate] unexpected error in the speech fallback path — continuing the class regardless:", e);
      setStatus("A voice hiccup on this step — continuing the lesson.");
      finishAfterMinDisplay();
    }
  }
  async function continueClassFromNextPage(activeLesson:any,runId:number){
    if(playbackRunRef.current!==runId)return;
    setClassStarted(false);setSpeaking(false);setBoardPlaying(false);
    setStatus(`Prepared class complete · ${activeLesson?.scenes?.length || 0} scenes taught. AI was not called during playback.`);
  }
  function openChapterTest(active: Scene, sceneIndex: number) {
    const questions = active.chapterQuestions || [];
    if (!questions.length) return false;
    setSpeaking(false); setBoardPlaying(false); setClassStarted(false);
    setChapterAnswers({}); setChapterResult(null);
    setChapterTest({ sceneIndex, chapterId: active.chapterId || `chapter-${sceneIndex + 1}`, chapterTitle: active.chapterTitle || active.title, questions });
    setStatus(`Chapter complete. Take the 5-question test before the next chapter.`);
    return true;
  }
  async function submitChapterTest() {
    if (!chapterTest || Object.keys(chapterAnswers).length < chapterTest.questions.length) { setStatus("Answer every question before submitting the chapter test."); return; }
    const answers = chapterTest.questions.map(q => ({ question: q.question, selectedIndex: chapterAnswers[q.id], correctIndex: q.correctIndex, correct: chapterAnswers[q.id] === q.correctIndex, bloomsLevel: q.bloomsLevel }));
    const score = answers.filter(a => a.correct).length, total = answers.length, percentage = Math.round((score / total) * 100), passed = percentage >= 60;
    setChapterResult({ score, total, percentage, passed });
    try {
      const response = await fetch("/api/student/chapter-assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: profile?.email || profile?.name || "local-student", documentId: doc, textbookTitle: docs.find(d => d.id === doc)?.name, subject: docs.find(d => d.id === doc)?.subject, chapterId: chapterTest.chapterId, chapterTitle: chapterTest.chapterTitle, answers }) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (isSessionExpiredResponse(response.status, body?.error)) {
          // Distinct from every other failure below: the score is
          // genuinely calculated and shown, but it was NOT saved, which
          // means it will NOT reach Progress or the Parent Portal — the
          // student needs to know that plainly, not a vague "retry".
          setStatus(`Test scored ${score}/${total} (${percentage}%), but your login has expired so this result was NOT saved and will NOT reach the Parent Portal. Log in again, then retake this chapter's test to record it.`);
          return;
        }
        throw new Error(body?.error || "Could not save test result");
      }
      setStatus(`Chapter test saved · ${score}/${total} (${percentage}%). This result is now available in Progress and the Parent Portal.`);
    } catch { setStatus(`Test scored ${score}/${total}, but the parent report could not be saved. Please retry.`); }
  }
  function continueAfterChapterTest() {
    if (!chapterTest || !chapterResult) return;
    const following = chapterTest.sceneIndex + 1;
    setChapterTest(null); setChapterResult(null); setChapterAnswers({}); setClassStarted(true);
    const runId = ++playbackRunRef.current;
    if (following < (lesson?.scenes?.length || 0)) playSceneAt(following, lesson, runId); else void continueClassFromNextPage(lesson, runId);
  }
  function playSceneAt(next:number,activeLesson:any=lesson,runId=playbackRunRef.current,startUnitIndex=0){
    if(playbackRunRef.current!==runId)return;
    const active=activeLesson?.scenes?.[next] as Scene|undefined;
    if(!active){setClassStarted(false);return;}
    syncScene(next,activeLesson);
    let advanced=false;
    const advance=()=>{if(advanced||playbackRunRef.current!==runId)return;advanced=true;if(active.chapterEnd&&openChapterTest(active,next))return;const following=next+1;if(following<(activeLesson?.scenes?.length||0))window.setTimeout(()=>playSceneAt(following,activeLesson,runId),500);else{setSpeaking(false);setBoardPlaying(false);void continueClassFromNextPage(activeLesson,runId);}};
    if(active.phase==="unit"){
      setBoardPlaying(false);
      // The combined "explain while writing" pass — replaces what used
      // to be two separate steps (a whole-block spoken explanation
      // with the board blank, THEN a separately-timed board animation
      // narrating its own "solve" script) with ONE pass where the
      // board writes and speaks line by line together, using each
      // write command's own .narration field (see
      // lib/whiteboard-commands.ts and the WHITEBOARD_COMMAND_JSON_
      // INSTRUCTION prompt that asks the model for exactly this).
      // Runs ONCE per page/scene, not once per paragraph — whiteboard-
      // Commands describes the whole page's board, not one paragraph
      // at a time, so replaying all of it after every paragraph would
      // just repeat the same walkthrough over and over.
      const explainWhileWriting=(afterBoard:()=>void)=>{
        if(playbackRunRef.current!==runId)return;
        const hasRealBoardContent = normalizeWhiteboardPlan(active.whiteboardCommands, active.board||[]).commands.length > 0;
        if(!hasRealBoardContent){
          // No board content at all for this page — fall back to a
          // plain spoken explanation so the class still teaches
          // something instead of silently skipping to the next page.
          if(!active.narration){afterBoard();return;}
          setStatus(`Explaining ${active.title}.`);
          void narrate(active.narration,afterBoard,active.narrationLanguage||teachingLanguage,false,true);
          return;
        }
        setStatus(`Explaining ${active.title} while writing it on the whiteboard.`);
        setSpeaking(true);
        // Same reasoning as narrate()'s fix above: this whole step
        // depends on WhiteboardCommandEngine's onComplete callback
        // actually firing (see the JSX below), with nothing else
        // driving it forward. If the board's own animation loop ever
        // gets stuck — a malformed AI-generated command, an unexpected
        // internal error — this would otherwise wait forever with the
        // class just silently stopped on this scene. A bounded timeout
        // guarantees the class always moves on eventually, exactly
        // like every other step in this file now does.
        let boardDone = false;
        const finishBoard = () => {
          if (boardDone || playbackRunRef.current!==runId) return;
          boardDone = true;
          setSpeaking(false); setBoardPlaying(false); afterBoard();
        };
        const boardWatchdog = window.setTimeout(() => {
          console.error("[explainWhileWriting] whiteboard never signalled completion — continuing the class regardless");
          finishBoard();
        }, 3 * 60 * 1000);
        boardCompleteRef.current = () => { window.clearTimeout(boardWatchdog); finishBoard(); };
        setBoardPlaying(true);
      };
      if(active.paragraphUnits && active.paragraphUnits.length>0){
        // Paragraph-by-paragraph: read each paragraph's original
        // textbook text first (browser TTS, unchanged from before —
        // still exactly "the PDF read by the browser"), THEN the
        // combined board walkthrough above teaches the whole page.
        // See lib/paragraph-units.ts.
        const units=active.paragraphUnits;
        const readSource=(unitIndex:number)=>{
          if(playbackRunRef.current!==runId)return;
          if(unitIndex>=units.length){explainWhileWriting(advance);return;}
          setActiveUnitIndex(unitIndex);
          const unit=units[unitIndex];
          const afterThisSource=()=>readSource(unitIndex+1);
          if(unit.source){
            setStatus(`Reading paragraph ${unitIndex+1}/${units.length} of textbook page ${active.sourcePage||pageNum}.`);
            void narrate(unit.source,afterThisSource,active.sourceLanguage||sourceLanguage,false);
          }else afterThisSource();
        };
        readSource(startUnitIndex);
        return;
      }
      if(active.sourceNarration){
        setStatus(`Reading textbook page ${active.sourcePage||pageNum}; notes and whiteboard remain locked to this unit.`);
        void narrate(active.sourceNarration,()=>explainWhileWriting(advance),active.sourceLanguage||sourceLanguage,false);
      } else explainWhileWriting(advance);
      return;
    }
    if(active.phase==="read")setStatus(`Reading the highlighted textbook paragraph.`);else if(active.phase==="explain")setStatus(`Explaining in ${active.narrationLanguage||teachingLanguage}.`);else if(active.phase==="solve")setStatus("Solving on the whiteboard.");
    void narrate(active.narration,advance,active.narrationLanguage||(active.phase==="read"?sourceLanguage:teachingLanguage),active.phase==="solve",active.phase!=="read");
  }
  // WHY the 4th argument: previously playSceneAt() always started a
  // paragraph-unit scene at paragraph 0, no matter where playback had
  // been paused — this is what was resetting the class to the
  // beginning of the CURRENT page's reading + translation every time
  // "Resume Class" was pressed, even mid-paragraph. scene itself is
  // untouched by pauseTeaching(), and activeUnitIndex already tracks
  // the last paragraph actually reached (set on every playUnit call),
  // so passing it through here resumes from exactly that paragraph —
  // moving to a genuinely different scene (advance(), goScene(),
  // continueAfterChapterTest()) still starts fresh at 0 by default,
  // since only a same-scene resume should skip ahead.
  function speak() { if (!lesson?.scenes?.[scene]) return; const runId=++playbackRunRef.current;setClassStarted(true);playSceneAt(scene,lesson,runId,activeUnitIndex); }
  async function startClass() {
    // Warm up the device TTS engine during the click (user gesture) so
    // the first narration starts immediately instead of paying the
    // 1-3 s engine-initialization cost on scene 1.
    primeSpeechEngine();
    // Proactive check, not reactive: tell the student BEFORE the class
    // starts if their chosen teaching language has no voice on this
    // device, instead of them discovering it as a silently-skipped
    // scene with only a small dim status line as explanation (see
    // narrate()'s comment for the full mechanism this was masking).
    // The class still starts either way — narrate()'s minimum-display-
    // duration fix means it teaches properly via whiteboard + text even
    // with no audio — this is purely about the student understanding
    // why, upfront, with an actionable way to switch language if they'd
    // rather have narration.
    const voiceOk = await hasVoiceFor(teachingLanguage);
    const langLabel = SUPPORTED_LANGUAGES.find(item => item.id === teachingLanguage)?.label || teachingLanguage;
    setVoiceWarning(voiceOk ? null : `No ${langLabel} voice was found on this device. The class will still teach using the whiteboard and on-screen text, but without spoken narration. Install a ${langLabel} voice in your phone's Settings \u2192 Language \u2192 Text-to-speech, or switch the teaching language below.`);
    setClassStarted(true);
    if (lesson?.scenes?.length) { const runId=++playbackRunRef.current;playSceneAt(scene,lesson,runId); }
    else await createLesson(true);
  }
  function pauseTeaching() { playbackRunRef.current++; window.speechSynthesis.cancel(); stopNarrationAudio(); setSpeaking(false); setBoardPlaying(false); }
  function goScene(next: number) { playbackRunRef.current++;window.speechSynthesis.cancel();stopNarrationAudio();setSpeaking(false);if(classStarted){const runId=playbackRunRef.current;playSceneAt(next,lesson,runId);}else syncScene(next); }

  /** Finds the scene whose sourcePage exactly matches, or — for a page
   *  with no dedicated teaching scene (e.g. a title/reference page the
   *  lesson skipped) — the closest PRECEDING scene, so the notes and
   *  whiteboard land on the most relevant available content rather than
   *  nothing. Returns -1 if there's no lesson loaded yet at all.
   *  Logic lives in lib/scene-page-sync.ts so it's independently
   *  testable. */
  function findSceneIndexForPage(page: number): number {
    return findSceneIndexForPageImpl(lesson?.scenes, page);
  }

  /**
   * The single entry point for ALL manual PDF-page navigation (thumbnail
   * clicks, the PDF viewer's own prev/next buttons) — previously these
   * called setPageNum() directly, which moved the visible PDF page but
   * left the AI notes and whiteboard frozen on whatever scene was last
   * active, showing content for a DIFFERENT page than what the PDF pane
   * displayed. This routes through goScene() instead — the SAME
   * mechanism the separate scene-navigation buttons already used
   * correctly — so the notes/whiteboard genuinely follow the PDF page,
   * not just the other way around.
   *
   * HONEST TRADEOFF: if the clicked page has no scene of its own, this
   * lands on the closest earlier scene's page instead of the literal
   * page clicked — the PDF view "snaps" to whatever page the notes and
   * whiteboard are actually showing, rather than leaving three panes on
   * three different pages. For the common case (a scene per page), this
   * snapping never happens and the numbers just match everywhere.
   */
  function goToPage(page: number) {
    const clamped = Math.max(1, Math.min(totalPages, page));
    const matchedScene = findSceneIndexForPage(clamped);
    if (matchedScene !== -1 && matchedScene !== scene) goScene(matchedScene);
    else setPageNum(clamped);
  }

  async function ask() {
    if (!question) return;
    const asked = question;
    setThread(prev => [...prev, { role: "student", text: asked }]);
    setQuestion(""); setBusy(true);
    try {
      const extracts = await fetchGrounding(doc, asked, 6); setSources(extracts);
      const context = compactTextbookContext(extracts, 9000);
      const x = await generateWithSelectedAI({
        task: "rag_answer",
        system: `Answer using ONLY the supplied textbook extracts. Be concise and cite [S1], [S2]. ${teachingLanguageInstruction({ sourceLanguage, teachingLanguage, materialLanguage, teachingStyle })}`,
        prompt: `QUESTION: ${asked}\n\nTEXTBOOK EXTRACTS:\n${context}`,
        serverCall: async () => {
          const r = await fetch("/api/rag/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: asked, documentId: doc }) });
          const y = await r.json(); if (!r.ok) throw Error(y.error || "Question failed"); return y.answer;
        },
      });
      setThread(prev => [...prev, { role: "ai", text: `${x.text}${x.warning ? `\n\n${x.warning}` : ""}` }]);
    } catch (e: any) { setThread(prev => [...prev, { role: "ai", text: e.message || "Question failed" }]); }
    setBusy(false);
  }

  useEffect(() => {
    if (notes) return;
    const savedNotes = materials.notes?.data || materials.revision?.data;
    if (savedNotes) setNotes(savedNotes);
  }, [materials, notes]);

  function openMaterialStudioForMissingPack(label: string) {
    setStatus(`${label} has not been prepared for this textbook. Create it once in Material Studio; RAG Classroom will then replay it without AI calls.`);
    router.push("/material-studio");
  }

  function openCreatedMaterial(cardKey: string, label: string, material: any) {
    if (!material) return;
    const sections = Array.isArray(material.sections) ? material.sections : [];
    setSelectedMaterialKey(cardKey);
    setSelectedMaterialLabel(label);
    setNotes(material);
    setCenterTab("notes");
    setTopic(material.title || label);
    setLessonSafe({
      title: material.title || label,
      scenes: sections.map((section: any, index: number) => ({
        type: label,
        title: section.heading || `${label} ${index + 1}`,
        narration: section.content || section.answer || "",
        board: [section.heading, section.content, section.activity, section.answer].filter(Boolean),
        question: section.activity || "",
        sourceIds: section.sourceIds || [],
        sourcePage: Number(section.sourcePage || material.sources?.find((source:any)=>section.sourceIds?.includes(source.id))?.page || material.sources?.[Math.min(index,(material.sources?.length||1)-1)]?.page || 1),
        visual: section.visual,
        whiteboardCommands: section.whiteboardCommands,
      })),
    });
    setScene(0);setBoardPlaying(true);setBoardSyncToken(value => value + 1);
    textbookContext.set({ documentId: doc, documentName: activeDoc?.name || "Indexed textbook", topic: material.title || label });
  }

  async function confirmDeleteMaterial(key: string, label: string) {
    const material = materials[key];
    if (!material?.data) return;
    const confirmed = window.confirm(`Do you want to delete “${label}”?\n\nThe saved content will be removed. This action cannot be undone.`);
    if (!confirmed) return;
    try {
      if (material.recordId) await deleteOfflineMaterial(material.recordId);
      setMaterials(previous => { const next = { ...previous }; delete next[key]; return next; });
      if (selectedMaterialLabel === label) {
        setSelectedMaterialLabel(""); setSelectedMaterialKey(""); setNotes(null); setLessonSafe(null); setScene(0); setCenterTab("teacher");
      }
      setStatus(`${label} was deleted.`);
    } catch (error: any) {
      setStatus(`Could not delete ${label}: ${error?.message || "please try again."}`);
    }
  }

  function captureSelection() { const sel = window.getSelection()?.toString().trim() || ""; if (sel.length > 2) setSelectedText(sel); }
  function askAboutSelection() { if (selectedText) pendingDoubt.ask(selectedText); }

  function toggleBookmark() {
    const next = !bookmarked; setBookmarked(next);
    if (doc) localStorage.setItem(`ai-guru-bookmark-${doc}`, next ? "1" : "0");
  }

  // Lazily rasterise a small window of pages around the current one for
  // the thumbnail strip — real page images (lib/client/pdf-page.ts),
  // not placeholder tiles, but capped to a window so a 300-page textbook
  // never renders the whole book at once.
  useEffect(() => {
    if (!pdfFile) return;
    const want = [pageNum - 2, pageNum - 1, pageNum, pageNum + 1, pageNum + 2].filter(p => p >= 1 && p <= (docs.find(d => d.id === doc)?.pages || 1) && !thumbs[p]);
    if (!want.length) return;
    let cancelled = false;
    pdfFile.arrayBuffer().then(ab => renderPdfPagesToDataUrls(ab, want, 0.35)).then(res => {
      if (cancelled) return;
      setThumbs(prev => { const next = { ...prev }; for (const r of res) next[r.page] = r.dataUrl; return next; });
    }).catch(() => { });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfFile, pageNum]);

  function endClass() {
    playbackRunRef.current++;
    window.speechSynthesis.cancel(); stopNarrationAudio();
    setSpeaking(false); setBoardPlaying(false);
    router.push("/dashboard");
  }

  const s: Scene | undefined = lesson?.scenes?.[scene];
  const spotlightSource = lesson?.sources?.find((source:any)=>s?.sourceIds?.includes(source.id));
  // Spotlight the paragraph CURRENTLY being taught, not a static phrase
  // fixed for the whole scene — activeUnitIndex is the same state that
  // already drives the split-view text panel and the audio sequencing,
  // so the torch beam on the textbook page now moves to the matching
  // paragraph as teaching progresses through it, instead of staying
  // parked on wherever the scene started. Falls back to the original
  // whole-scene phrase for scenes without paragraph units.
  const activeUnitForSpotlight = s?.paragraphUnits?.[Math.min(activeUnitIndex, (s.paragraphUnits.length||1)-1)];
  const spotlightPhrase = activeUnitForSpotlight?.source || s?.spotlight || spotlightSource?.text?.split(/(?<=[.!?])\s+/)?.[0]?.slice(0,180) || "";
  const activeDoc = docs.find(d => d.id === doc);
  const totalPages = activeDoc?.pages || 1;

  const TB_TOOLS: { id: typeof tbTool; icon: any; label: string }[] = [
    { id: "pointer", icon: MousePointer2, label: "Pointer" },
    { id: "pen", icon: Pencil, label: "Pen" },
    { id: "highlighter", icon: Highlighter, label: "Highlighter" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
  ];
  const BW_TOOLS: { id: DrawTool; icon: any; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "pen", icon: Pencil, label: "Pen" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
    { id: "text", icon: Type, label: "Text" },
    { id: "shape", icon: Shapes, label: "Shapes" },
  ];
  const BW_COLORS = ["#111111", "#ef4444", "#3b82f6", "#8b5cf6", "#22c55e"];

  return (
    <div className={`fixed inset-0 z-40 flex ${theme === "light" ? "bg-[#f4f1e8] text-[#16241d]" : "bg-board text-chalk"}`}>
      <RagClassroomSidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* ── Top header ── */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-board3 px-5 py-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-lg text-chalk">RAG Classroom</p>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${classStarted ? "bg-emerald-500 text-white" : "bg-board3 text-chalkdim"}`}>{classStarted ? t(uiLanguage, "liveClass") : "Not started"}</span>
              </div>
            </div>
            <div className="hidden h-8 w-px bg-board3 sm:block" />
            <div className="hidden sm:block">
              <p className="font-display text-xl leading-tight text-chalk">{lesson?.title || topic || "Pick a topic to begin"}</p>
              <p className="text-xs text-chalkdim">
                {[activeDoc?.subject, activeDoc?.grade ? `Class ${activeDoc.grade}` : null, activeDoc?.syllabus === "kerala" ? "Kerala State" : activeDoc?.syllabus?.toUpperCase()].filter(Boolean).join(" · ") || "No textbook selected"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-lg border border-board3 bg-board2 px-2 py-1.5 text-xs">
              <Globe size={14} className="text-chalkdim" />
              <select value={uiLanguage} onChange={e => setUiLanguage(e.target.value)} className="bg-transparent text-chalk outline-none">
                {SUPPORTED_LANGUAGES.slice(0, 8).map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <button onClick={() => setTheme(v => v === "dark" ? "light" : "dark")} className="rounded-lg border border-board3 bg-board2 p-2 text-chalkdim hover:text-chalk" title="Toggle theme">
              {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button className="relative rounded-lg border border-board3 bg-board2 p-2 text-chalkdim hover:text-chalk" title="Notifications">
              <Bell size={16} />
              {Object.values(materials).some(m => m.data) && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">{Object.values(materials).filter(m => m.data).length}</span>}
            </button>
            <div className="flex items-center gap-2 rounded-lg border border-board3 bg-board2 px-2 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{(profile?.name || "S").slice(0, 1).toUpperCase()}</div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-xs font-semibold text-chalk">{profile?.name || "Student"}</p>
                <p className="text-[10px] text-chalkdim">{profile?.grade ? `Class ${profile.grade}` : ""}</p>
              </div>
            </div>
          </div>
        </header>

        {/* ── Control row ── */}
        <div className="flex flex-wrap items-center gap-3 border-b border-board3 bg-board/60 px-5 py-2.5">
          {activeDoc && (
            <span className="flex items-center gap-1.5 rounded-full bg-board2 border border-board3 px-3 py-1 text-xs font-semibold text-chalk" title={activeDoc.name}>
              <BookOpen size={13} className="text-amber shrink-0" />
              <span className="max-w-[16rem] truncate">{activeDoc.name}</span>
              {activeDoc.subject && <span className="rounded-full bg-amber/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber">{activeDoc.subject}</span>}
            </span>
          )}
          <label className="text-xs text-chalkdim">Language
            <select value={sourceLanguage} onChange={e => setSourceLanguage(e.target.value)} className="ml-2 rounded-lg border border-board3 bg-board2 px-2 py-1 text-chalk">
              {SUPPORTED_LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-chalkdim">Teach Me In
            <select value={teachingLanguage} onChange={e => changeTeachingLanguage(e.target.value)} className="ml-2 rounded-lg border border-board3 bg-board2 px-2 py-1 text-chalk">
              {SUPPORTED_LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-chalkdim">Material Language
            <select value={materialLanguage} onChange={e => setMaterialLanguage(e.target.value)} className="ml-2 rounded-lg border border-board3 bg-board2 px-2 py-1 text-chalk">
              {SUPPORTED_LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-chalkdim">{t(uiLanguage, "teachingStyle")}
            <select value={teachingStyle} onChange={e => setTeachingStyle(e.target.value as TeachingStyle)} className="ml-2 rounded-lg border border-board3 bg-board2 px-2 py-1 text-chalk">
              <option value="target_with_english_terms">Concept + Examples</option>
              <option value="target_only">Teaching language only</option>
              <option value="simple_english">Simple English</option>
            </select>
          </label>

          <div className="ml-1 flex items-center gap-1 rounded-lg border border-board3 bg-board2 p-1">
            {TB_TOOLS.map(tool => (
              <button key={tool.id} title={tool.label} onClick={() => setTbTool(tool.id)}
                className={`rounded-md p-1.5 ${tbTool === tool.id ? "bg-amber text-board" : "text-chalkdim hover:text-chalk"}`}>
                <tool.icon size={15} />
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-chalkdim">Teaching speed
              <select value={teachingSpeed} onChange={e => setTeachingSpeed(Number(e.target.value))} aria-label="AI teacher speaking speed" className="rounded-lg border border-board3 bg-board2 px-2 py-1 text-chalk">
                <option value={0.6}>Very slow</option>
                <option value={0.75}>Slow</option>
                <option value={0.85}>Gentle</option>
                <option value={1}>Normal</option>
                <option value={1.2}>Fast</option>
              </select>
            </label>
            <div className="flex items-center gap-1 text-xs text-chalkdim">
              {t(uiLanguage, "textSize")}
              <button onClick={() => setTextSize(v => Math.max(70, v - 10))} className="rounded-md border border-board3 bg-board2 p-1"><ZoomOut size={13} /></button>
              <span className="w-10 text-center text-chalk">{textSize}%</span>
              <button onClick={() => setTextSize(v => Math.min(160, v + 10))} className="rounded-md border border-board3 bg-board2 p-1"><ZoomIn size={13} /></button>
            </div>
            <label className="text-xs text-chalkdim">{t(uiLanguage, "boardStyle")}
              <select value={boardStyle} onChange={e => setBoardStyle(e.target.value as "handwriting" | "print")} className="ml-2 rounded-lg border border-board3 bg-board2 px-2 py-1 text-chalk">
                <option value="handwriting">Handwriting</option>
                <option value="print">Print</option>
              </select>
            </label>
            <button onClick={startClass} disabled={!doc || busy || speaking} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              <Play size={13} /> {speaking ? "Teaching…" : classStarted ? "Resume Class" : "Start Class"}
            </button>
            {/* Pause — stays IN the classroom (unlike End Class below), so a
                student can interrupt to ask a doubt via the camera/mic pane
                and pick up exactly where they left off with "Resume Class"
                above. Reuses pauseTeaching() as-is: it already stops
                narration/whiteboard without touching scene position or
                navigating anywhere. Previously the only way to do this was
                a small unlabeled icon button inside one specific tab — easy
                to miss, especially next to the much more prominent,
                exit-styled "End Class" button. */}
            <button onClick={pauseTeaching} disabled={!speaking} title="Stop the AI teacher here so you can ask a doubt — resume anytime with Resume Class" className="flex items-center gap-1.5 rounded-lg border border-amber/50 bg-amber/10 px-3 py-1.5 text-xs font-semibold text-amber hover:bg-amber/20 disabled:cursor-not-allowed disabled:opacity-40">
              <Pause size={13} /> Pause
            </button>
            <button onClick={endClass} className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20">
              <LogOut size={13} /> {t(uiLanguage, "endClass")}
            </button>
          </div>
        </div>

        {voiceWarning && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <span className="flex-1">{voiceWarning}</span>
            <button onClick={() => setVoiceWarning(null)} className="shrink-0 rounded-md px-1.5 py-0.5 text-amber-200/70 hover:bg-amber-500/20 hover:text-amber-200" aria-label="Dismiss">✕</button>
          </div>
        )}

        {/* ── Main body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4" style={{ fontSize: `${textSize}%` }}>
          {chapterTest && (
            <section className="mx-auto mb-5 max-w-4xl rounded-2xl border-2 border-amber bg-board2 p-5 shadow-2xl">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-amber">Chapter-end test</p><h2 className="font-display text-2xl text-chalk">{chapterTest.chapterTitle}</h2><p className="text-xs text-chalkdim">Complete all questions. A score of 60% or more shows chapter readiness.</p></div>{chapterResult && <div className={`rounded-xl px-4 py-2 text-center ${chapterResult.passed ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}><b className="text-xl">{chapterResult.percentage}%</b><p className="text-[10px]">{chapterResult.score}/{chapterResult.total} correct</p></div>}</div>
              <div className="space-y-4">{chapterTest.questions.map((q, qi) => <div key={q.id} className="rounded-xl border border-board3 bg-board p-4"><p className="mb-3 text-sm font-semibold text-chalk">{qi + 1}. {q.question}</p><div className="grid gap-2 sm:grid-cols-2">{q.options.map((option, oi) => { const chosen=chapterAnswers[q.id]===oi; const reveal=Boolean(chapterResult); const correct=oi===q.correctIndex; return <button type="button" disabled={reveal} key={oi} onClick={()=>setChapterAnswers(prev=>({...prev,[q.id]:oi}))} className={`rounded-lg border px-3 py-2 text-left text-xs ${reveal&&correct?"border-emerald-400 bg-emerald-500/15":reveal&&chosen&&!correct?"border-rose-400 bg-rose-500/15":chosen?"border-amber bg-amber/10":"border-board3 hover:border-amber/60"}`}>{String.fromCharCode(65+oi)}. {option}</button>})}</div>{chapterResult&&q.explanation&&<p className="mt-2 text-xs text-chalkdim">{q.explanation}</p>}</div>)}</div>
              <div className="mt-5 flex justify-end">{!chapterResult?<button onClick={()=>void submitChapterTest()} className="rounded-xl bg-amber px-5 py-3 font-bold text-board">Submit chapter test</button>:<button onClick={continueAfterChapterTest} className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white">Continue to next chapter →</button>}</div>
            </section>
          )}
          {!doc && (
            <div className="mx-auto max-w-3xl space-y-4">
              <section className="space-y-3">
                {Object.keys(groups).length === 0 && <p className="text-sm text-chalkdim">No textbooks indexed yet — add one below to get started.</p>}
                {Object.entries(groups).map(([subject, list]) => (
                  <div key={subject}>
                    <p className="mb-1 font-mono text-xs uppercase text-chalkdim">{subject}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {list.map(d => (
                        <button key={d.id} onClick={() => selectDoc(d.id)} className="shrink-0 rounded-xl border border-board3 bg-board2 px-4 py-2 text-left text-sm hover:border-marigold">
                          <div className="font-semibold">{d.grade ? `${subject} · ${d.grade}` : d.name}</div>
                          <div className="text-xs text-chalkdim">{d.pages} pages</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
              <details className="rounded-2xl border border-board3 bg-board2 p-4">
                <summary className="flex cursor-pointer items-center gap-2"><Upload size={18} /><b>Add a new textbook</b></summary>
                <div className="mt-3 space-y-2">
                  <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
                  <div className="flex gap-2">
                    <input value={uploadSubject} onChange={e => setUploadSubject(e.target.value)} placeholder="Subject, e.g. Maths" className="min-w-0 flex-1 rounded-lg bg-board p-2" />
                    <input value={uploadGrade} onChange={e => setUploadGrade(e.target.value)} placeholder="Grade, e.g. Class 9" className="w-32 rounded-lg bg-board p-2" />
                  </div>
                  <button disabled={!file || busy} onClick={upload} className="rounded-lg bg-amber px-4 py-2 font-semibold text-board disabled:opacity-50">Index PDF</button>
                  {status && <p className="text-sm text-chalkdim">{status}</p>}
                </div>
              </details>
            </div>
          )}

          {doc && <div className="space-y-4">
            <section className="rounded-2xl border border-board3 bg-board2 p-3">
              <div className="mb-2 flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-wider text-chalkdim">Choose textbook / subject</p><p className="text-xs text-chalkdim">The PDF and its saved study-material pack switch together.</p></div><span className="shrink-0 rounded-full bg-leaf/15 px-2.5 py-1 text-[10px] font-bold text-leaf">{Object.values(materials).filter(item=>item.data).length}/{MATERIAL_CARDS.length} materials loaded</span></div>
              <div className="flex snap-x gap-2 overflow-x-auto pb-1">{docs.map(item=><div key={item.id} className={`relative min-w-52 shrink-0 snap-start rounded-xl border ${item.id===doc?"border-amber bg-amber/10":"border-board3 bg-board hover:border-amber/60"}`}><button type="button" onClick={()=>selectDoc(item.id)} className="w-full rounded-xl px-3 py-2 pr-10 text-left transition"><p className="truncate text-sm font-semibold text-chalk">{item.subject||item.name.replace(/\.pdf$/i,"")}</p><p className="mt-0.5 truncate text-[10px] text-chalkdim">{item.name} · {item.pages} pages{item.grade?` · Class ${item.grade}`:""}</p><p className="mt-1 text-[10px] text-amber">{item.syllabus==="kerala"?"Kerala State":item.syllabus?.toUpperCase()||"Syllabus not set"}{item.learningLanguage?` · Learn in ${item.learningLanguage}`:""}</p></button><button type="button" aria-label={`Delete ${item.subject||item.name}`} title={`Delete ${item.subject||item.name}`} disabled={busy} onClick={()=>void confirmDeleteTextbook(item.id)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-rose-400/50 bg-rose-500/15 text-rose-300 transition hover:bg-rose-500 hover:text-white disabled:opacity-40"><X size={15}/></button></div>)}</div>
            </section>
            {!lesson && (
              <section className="rounded-2xl border border-board3 bg-board2 p-4 space-y-3">
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic, e.g. Pairs of Linear Equations in Two Variables" className="min-w-0 rounded-lg bg-board p-2" />
                  <button disabled={!topic || busy} onClick={() => void createLesson()} className="rounded-lg bg-amber px-4 py-2 font-semibold text-board disabled:opacity-50">Teach</button>
                </div>
                {status && <p className="text-xs text-chalkdim">{status}</p>}
              </section>
            )}

            {floatingEnabled && (
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] text-chalkdim">Drag a panel's title bar to move it, or its bottom-right corner to resize.</p>
                <button onClick={resetPanels} className="rounded-lg border border-board3 px-2.5 py-1 text-[10px] font-semibold text-chalkdim hover:border-amber/50 hover:text-amber">Reset layout</button>
              </div>
            )}
            <section
              ref={panelCanvasRef}
              className={floatingEnabled ? "relative" : "grid grid-cols-2 gap-3 xl:grid-cols-3"}
              style={floatingEnabled ? { height: panelCanvasSize.h } : undefined}
            >
              {/* 1. TEXTBOOK */}
              <FloatingPanel id="textbook" title="Textbook" floatingEnabled={floatingEnabled} rect={panelLayout.textbook} canvasSize={panelCanvasSize} onRectChange={updatePanelRect} onFocus={focusPanel} staticClassName="min-w-0 rounded-2xl border border-board3 bg-board2 p-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => goToPage(pageNum - 1)} className="rounded-lg border border-board3 p-1"><ChevronLeft size={14} /></button>
                    <span className="font-mono text-xs text-chalkdim">{pageNum} / {totalPages}</span>
                    <button onClick={() => goToPage(pageNum + 1)} className="rounded-lg border border-board3 p-1"><ChevronRight size={14} /></button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="rounded-md border border-board3 p-1"><ZoomOut size={13} /></button>
                    <span className="w-10 text-center text-xs text-chalkdim">{zoom}%</span>
                    <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="rounded-md border border-board3 p-1"><ZoomIn size={13} /></button>
                    <button onClick={toggleBookmark} className={`rounded-md border border-board3 p-1 ${bookmarked ? "text-amber" : "text-chalkdim"}`}><Bookmark size={13} fill={bookmarked ? "currentColor" : "none"} /></button>
                  </div>
                </div>
                <div className="relative h-[520px] overflow-auto rounded-xl bg-white" onMouseUp={captureSelection}>
                  {pdfFile
                    ? <div style={{ width: `${zoom}%` }}><TextbookPageView file={pdfFile} pageNumber={pageNum} spotlight={spotlightPhrase} laserPointer={Boolean(s&&classStarted)} /></div>
                    : pdfUrl
                      ? <div style={{ width: `${zoom}%`, height: `${zoom}%` }}><iframe key={pageNum} src={`${pdfUrl}#page=${pageNum}&view=FitH&toolbar=0&navpanes=0&scrollbar=0`} className="h-full w-full border-0" title="Textbook PDF without vertical thumbnail sidebar" /></div>
                      : <div className="flex h-full items-center justify-center px-4 text-center text-sm text-chalkdim">No PDF saved for this textbook in this browser yet — re-index it to save a viewable copy.</div>}
                  {pdfUrl && <DrawableCanvas ref={tbCanvasRef} tool={tbTool === "pointer" ? "select" : tbTool} color={tbColor} active={tbTool !== "pointer"} />}
                </div>
                <div className="mt-2 flex gap-1.5 overflow-x-auto px-2 pb-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => Math.max(1, pageNum - 2) + i).filter(p => p <= totalPages).map(p => (
                    <button key={p} onClick={() => goToPage(p)} className={`shrink-0 overflow-hidden rounded-lg border ${p === pageNum ? "border-amber" : "border-board3"}`}>
                      {thumbs[p] ? <img src={thumbs[p]} alt={`Page ${p}`} className="h-16 w-12 object-cover" /> : <div className="flex h-16 w-12 items-center justify-center bg-board text-[10px] text-chalkdim">{p}</div>}
                    </button>
                  ))}
                </div>
              </FloatingPanel>

              {/* 2. AI TEACHER / DOUBTS / NOTES / SUMMARY */}
              <FloatingPanel id="notes" title="AI Notes" floatingEnabled={floatingEnabled} rect={panelLayout.notes} canvasSize={panelCanvasSize} onRectChange={updatePanelRect} onFocus={focusPanel} staticClassName="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-board3 bg-board2">
                <div className="flex items-center justify-between border-b border-board3 px-4 py-3">
                  <div className="flex gap-4 text-xs">
                    {([["teacher", "AI Teacher"], ["doubts", "Doubts"], ["notes", "Notes"], ["summary", "Summary"]] as [CenterTab, string][]).map(([id, label]) => (
                      <button key={id} onClick={() => setCenterTab(id)} className={`border-b-2 pb-2 ${centerTab === id ? "border-amber text-amber" : "border-transparent text-chalkdim"}`}>{label}</button>
                    ))}
                  </div>
                  {/* Same page indicator style as the Textbook and AI
                      Whiteboard panels' headers (font-mono text-xs
                      text-chalkdim "N / total") — previously this page
                      number only showed as a small badge buried inside
                      the "AI Teacher" tab's content, invisible on the
                      other three tabs and visually inconsistent with the
                      other two panels. Always visible here now, on
                      every tab, so all three panels read as one synced
                      unit at a glance. */}
                  <span className="shrink-0 font-mono text-xs text-chalkdim">Page {s?.sourcePage || pageNum} / {totalPages}</span>
                </div>

                {centerTab === "teacher" && (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4" onMouseUp={captureSelection}>
                    {s ? <>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200">AI Teacher ({SUPPORTED_LANGUAGES.find(l => l.id === teachingLanguage)?.label || teachingLanguage})</span><span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">Synced to textbook page {s.sourcePage||pageNum}</span></div>
                        <button onClick={() => speaking ? pauseTeaching() : speak()} className="rounded-full bg-amber p-2 text-board">{speaking ? <Pause size={16} /> : <Play size={16} />}</button>
                      </div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-amber">{s.type}</p>
                      <h2 className="font-display text-xl text-chalk">{s.title}</h2>
                      {s.paragraphUnits && s.paragraphUnits.length > 0 ? (() => {
                        const unit = s.paragraphUnits[Math.min(activeUnitIndex, s.paragraphUnits.length - 1)];
                        return (
                          <>
                            <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-chalkdim">Paragraph {Math.min(activeUnitIndex, s.paragraphUnits.length - 1) + 1} / {s.paragraphUnits.length}</p>
                            <div className="mt-2 rounded-xl border border-sky-400/30 bg-sky-500/10 p-3">
                              <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-sky-300"><BookOpen size={11}/> Extracted text · read by browser ({SUPPORTED_LANGUAGES.find(l => l.id === (s.sourceLanguage||sourceLanguage))?.label || s.sourceLanguage || sourceLanguage})</p>
                              <p className="whitespace-pre-wrap text-sm leading-7 text-chalk">{unit.source || "—"}</p>
                            </div>
                            {unit.explanation && (
                              <div className="mt-3 rounded-xl border border-amber/30 bg-amber/10 p-3">
                                <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-amber"><MessageCircleQuestion size={11}/> Explained by Gemini{unit.solve ? " · then on the whiteboard" : ""} ({SUPPORTED_LANGUAGES.find(l => l.id === (s.narrationLanguage||teachingLanguage))?.label || s.narrationLanguage || teachingLanguage})</p>
                                <p className="whitespace-pre-wrap text-sm leading-7 text-chalk">{unit.explanation}</p>
                              </div>
                            )}
                          </>
                        );
                      })() : (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-chalk">{s.narration}</p>
                      )}
                      {s.question && <div className="mt-4 rounded-xl border border-amber/30 bg-amber/10 p-3 text-sm text-amber">{s.question}</div>}
                    </> : <div className="flex h-[430px] items-center justify-center text-center text-sm text-chalkdim">Enter a topic above and press Teach. The AI explanation will appear here while the whiteboard writes beside it.</div>}
                  </div>
                )}

                {centerTab === "doubts" && (
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4" onMouseUp={captureSelection}>
                    {thread.length === 0 && <p className="text-sm text-chalkdim">Ask a doubt below — answers are grounded in this textbook's indexed text.</p>}
                    <div className="space-y-2">
                      {thread.map((m, i) => (
                        <div key={i} className={`rounded-xl p-3 text-sm ${m.role === "student" ? "bg-board text-chalk" : "border border-indigo-500/20 bg-indigo-500/10 text-chalk"}`}>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-chalkdim">{m.role === "student" ? "You" : "AI Guru"}</p>
                          <p className="whitespace-pre-wrap">{m.text}</p>
                        </div>
                      ))}
                    </div>
                    {sources.length > 0 && (
                      <div className="mt-3 border-t border-board3 pt-2 text-xs text-chalkdim">
                        {sources.map((x: any) => <div key={x.id} className="mt-2"><b>{x.id} · page {x.page}</b> — {x.text}</div>)}
                      </div>
                    )}
                  </div>
                )}

                {centerTab === "notes" && (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4" onMouseUp={captureSelection}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="font-mono text-[10px] uppercase text-chalkdim">{selectedMaterialLabel || "Revision notes"}</p>
                      <button onClick={() => { if(!notes) return; const blob=new Blob([safeStringify(notes)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`${(activeDoc?.name||"notes").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-${selectedMaterialKey||"notes"}.json`; a.click(); URL.revokeObjectURL(url); }} disabled={!notes} className="text-[10px] text-chalkdim underline disabled:opacity-40">Download</button>
                    </div>
                    {driveStatus.notes && <p className="mb-2 text-xs text-chalkdim">{driveStatus.notes}</p>}
                    {!notes && <p className="text-sm text-chalkdim">Create notes once in Material Studio; the saved notes will appear here.</p>}
                    {notes && (selectedMaterialKey === "ppt" ? <PptSlideDeck material={notes} />
                      : selectedMaterialKey === "quiz" || selectedMaterialKey === "flashcards" ? <McqQuizDeck material={notes} />
                      : notes?.sections?.map((sec: any, i: number) => <div key={i} className="mb-3"><p className="text-sm font-semibold">{sec.heading}</p><p className="whitespace-pre-wrap text-xs leading-5 text-chalkdim">{sec.content}</p></div>))}
                    {notes && <button onClick={() => pendingDoubt.ask(`${notes.title || selectedMaterialLabel}: ${notes.overview || notes.sections?.[0]?.content || "Please explain this material"}`)} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"><MessageCircleQuestion size={14}/> Ask using camera & mic</button>}
                  </div>
                )}

                {centerTab === "summary" && (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4" onMouseUp={captureSelection}>
                    <p className="font-mono text-[10px] uppercase text-chalkdim">Summary</p>
                    {notes?.overview && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-chalk">{notes.overview}</p>}
                    {!notes?.overview && <p className="mt-2 text-sm text-chalkdim">A saved summary will appear here after it is created in Material Studio.</p>}
                    {lesson?.scenes?.length > 0 && (
                      <div className="mt-4 border-t border-board3 pt-3">
                        <p className="mb-1 text-xs font-semibold text-chalkdim">Scenes covered</p>
                        <ul className="list-inside list-disc text-xs text-chalkdim">
                          {lesson.scenes.map((sc: any, i: number) => <li key={i} className={i === scene ? "text-amber" : ""}>{sc.title}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-board3 p-3">
                  <div className="flex gap-2">
                    <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} className="min-w-0 flex-1 rounded-lg bg-board p-2 text-sm" placeholder="Ask a doubt or question…" />
                    <button onClick={ask} disabled={!question || busy} className="rounded-lg bg-indigo-600 p-2 text-white disabled:opacity-50"><Send size={17} /></button>
                  </div>
                </div>
              </FloatingPanel>

              {/* 3. AI WHITEBOARD */}
              <FloatingPanel id="whiteboard" title="AI Whiteboard" floatingEnabled={floatingEnabled} rect={panelLayout.whiteboard} canvasSize={panelCanvasSize} onRectChange={updatePanelRect} onFocus={focusPanel} staticClassName="col-span-2 min-w-0 overflow-hidden rounded-2xl border border-board3 bg-[#10251b] xl:col-span-1">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-board3 px-4 py-3">
                  <div><p className="font-mono text-xs uppercase text-chalkdim">AI Whiteboard</p><p className="text-sm font-semibold text-chalk">{lesson?.title || topic || "Live teaching board"}</p></div>
                  <div className="flex items-center gap-2">
                    {/* Same page indicator as the Textbook/AI Notes
                        headers — a whiteboard "scene" is a teaching step,
                        not a PDF page, so its own N/total counter (kept
                        below) doesn't by itself tell a student which
                        textbook page it's teaching. This does. */}
                    <span className="shrink-0 font-mono text-xs text-chalkdim">Page {s?.sourcePage || pageNum} / {totalPages}</span>
                    <div className="mx-1 h-4 w-px bg-board3" />
                    <button onClick={() => goScene(Math.max(0, scene - 1))} disabled={!s || scene === 0} className="rounded-lg border border-board3 p-2 disabled:opacity-30"><ChevronLeft size={17} /></button>
                    <span className="font-mono text-xs text-chalkdim">{s ? `${scene + 1} / ${lesson.scenes.length}` : "—"}</span>
                    <button onClick={() => goScene(Math.min((lesson?.scenes?.length || 1) - 1, scene + 1))} disabled={!s || scene >= lesson.scenes.length - 1} className="rounded-lg border border-board3 p-2 disabled:opacity-30"><ChevronRight size={17} /></button>
                  </div>
                </div>
                <div className="flex">
                  <div className="min-w-0 flex-1 p-3">
                    {s ? <div className={`relative flex min-h-[470px] items-start justify-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white p-2 ${boardStyle === "handwriting" ? "font-display" : "font-body"}`}>
                      <WhiteboardCommandEngine key={scene} plan={s.whiteboardCommands} fallbackLines={s.board || []} width={s.visual ? 430 : 720} height={520} playing={boardPlaying} syncToken={boardSyncToken} onNarrateLine={(text) => void speakBoardLine(text, s.narrationLanguage || teachingLanguage)} onComplete={() => boardCompleteRef.current()} />
                      {Boolean(s.visual) && <div className="mt-2 w-[280px] shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-lg"><DiagramRenderer visual={s.visual}/><p className="mt-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-500">Teacher diagram</p></div>}
                      <DrawableCanvas ref={bwCanvasRef} tool={bwTool} color={bwColor} active onHistoryChange={setBwHistory} />
                    </div> : <div className="relative flex h-[610px] items-center justify-center px-6 text-center text-sm text-chalkdim">
                      The live whiteboard will write the AI teacher's explanation here.
                      <DrawableCanvas ref={bwCanvasRef} tool={bwTool} color={bwColor} active onHistoryChange={setBwHistory} />
                    </div>}
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-board/80 p-3">
                      <button onClick={() => setBoardPlaying(v => !v)} className="rounded-full bg-amber p-2 text-board">{boardPlaying ? <Pause size={17} /> : <Play size={17} />}</button>
                      <span className="text-xs text-chalkdim">{boardStyle === "handwriting" ? "Handwriting" : "Print"} · auto page · erase cleanup</span>
                      <button onClick={() => setBoardSyncToken(x => x + 1)} className="rounded-lg border border-board3 px-3 py-1 text-xs">Replay</button>
                    </div>
                  </div>
                  <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-l border-board3 py-3">
                    {BW_TOOLS.map(tool => (
                      <button key={tool.id} title={tool.label} onClick={() => setBwTool(tool.id)}
                        className={`rounded-lg p-2 ${bwTool === tool.id ? "bg-amber text-board" : "text-chalkdim hover:text-chalk"}`}>
                        <tool.icon size={16} />
                      </button>
                    ))}
                    <div className="my-1 h-px w-6 bg-board3" />
                    <button title="Undo" disabled={!bwHistory.canUndo} onClick={() => bwCanvasRef.current?.undo()} className="rounded-lg p-2 text-chalkdim hover:text-chalk disabled:opacity-30"><Undo2 size={16} /></button>
                    <button title="Redo" disabled={!bwHistory.canRedo} onClick={() => bwCanvasRef.current?.redo()} className="rounded-lg p-2 text-chalkdim hover:text-chalk disabled:opacity-30"><Redo2 size={16} /></button>
                    <button title="Clear" onClick={() => bwCanvasRef.current?.clear()} className="rounded-lg p-2 text-chalkdim hover:text-rose-400"><Trash2 size={16} /></button>
                    <div className="my-1 h-px w-6 bg-board3" />
                    {BW_COLORS.map(c => (
                      <button key={c} onClick={() => setBwColor(c)} className={`h-5 w-5 rounded-full border-2 ${bwColor === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </FloatingPanel>
            </section>

            <button onClick={askAboutSelection} disabled={!selectedText} className="flex w-full items-center justify-center gap-2 rounded-lg border border-board3 bg-board2 p-2 text-sm disabled:opacity-40">
              <MessageCircleQuestion size={16} /> {selectedText ? `Ask AI Guru about: "${selectedText.slice(0, 60)}${selectedText.length > 60 ? "…" : ""}"` : "Highlight text above, then tap here to ask a doubt"}
            </button>

            {/* ── Study Materials Created ── */}
            <section className="rounded-2xl border border-board3 bg-board2 p-4">
              <p className="mb-3 text-sm font-semibold text-chalk">Study Materials Created</p>
              <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                {MATERIAL_CARDS.map(card => {
                  const m = materials[card.key];
                  const Icon = card.icon;
                  return (
                    <div key={card.key} className={`relative w-40 shrink-0 snap-start rounded-xl border bg-board ${selectedMaterialLabel===card.label?"border-amber ring-1 ring-amber/40":"border-board3 hover:border-marigold"}`}>
                    <button onClick={() => m?.data ? openCreatedMaterial(card.key, card.label, m.data) : openMaterialStudioForMissingPack(card.label)} disabled={!doc}
                      className="flex w-full flex-col items-start gap-1 rounded-xl p-3 pr-9 text-left disabled:opacity-60">
                      <Icon size={18} className="text-amber" />
                      <span className="text-xs font-semibold text-chalk">{card.label}</span>
                      <span className="text-[10px] text-chalkdim">
                        {m?.data?.sections?.length ? `${m.data.sections.length} sections · open` : "Create once in Material Studio"}
                      </span>
                    </button>
                    {m?.data && <button type="button" aria-label={`Delete ${card.label}`} title={`Delete ${card.label}`} onClick={() => void confirmDeleteMaterial(card.key, card.label)} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-rose-400/50 bg-rose-500/15 text-rose-300 transition hover:bg-rose-500 hover:text-white"><X size={14}/></button>}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>}
        </div>
      </div>
    </div>
  );
}
