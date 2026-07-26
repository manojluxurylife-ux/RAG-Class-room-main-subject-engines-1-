"use client";
import { PremiumGate } from "@/components/SubscriptionGate";
/**
 * Study Materials — the "kitchen". Students upload a textbook page here
 * and get back a structured, multi-segment study course, prepared once
 * and ready to teach from in the Classroom (the "dining room") — see
 * app/(student)/classroom/study/[id]/page.tsx for where it gets served.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChefHat, ImagePlus, BookOpen, Loader2, ArrowRight, X, CheckCircle2, Zap,
} from "lucide-react";
import { Card, PageHeader, Button } from "@/components/ui";
import { PDFPagePicker } from "@/components/PDFPagePicker";
import { TextbookShelf } from "@/components/TextbookShelf";
import { studentSession } from "@/lib/student-session";
import { restoreStudentSession } from "@/lib/client/restore-student-session";
import { STUDY_SUBJECTS, type StudyMaterial, type ExtraMaterialKind } from "@/lib/study-material-schema";
import { generateSegmentLocally, canRunLocalMaterialFallback } from "@/lib/client/local-material-fallback";
import { SharedMaterialPreviewModal } from "@/components/SharedMaterialPreviewModal";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { MathText } from "@/components/MathText";

const LANGUAGES = SUPPORTED_LANGUAGES.map(l => ({ id: l.id, label: l.label }));
const BOARDS = [
  { id: "cbse", label: "CBSE (NCERT)" }, { id: "kerala", label: "Kerala State" },
  { id: "tamilnadu", label: "Tamil Nadu" }, { id: "karnataka", label: "Karnataka" },
];
const CLASSES = ["V","VI","VII","VIII","IX","X","XI","XII"];

function StudyMaterialsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(() => studentSession.get());

  const [className,       setClassName]       = useState(profile?.className || "IX");
  const [syllabus,        setSyllabus]        = useState(profile?.syllabus || "cbse");
  const [subject,         setSubject]         = useState<string>(STUDY_SUBJECTS[0]);
  const [sourceLanguage,  setSourceLanguage]  = useState("english");
  const [targetLanguage,  setTargetLanguage]  = useState(profile?.languageId || "english");

  const [tbFile,    setTbFile]    = useState<File | null>(null);
  const [tbPreview, setTbPreview] = useState<string | null>(null);
  const [pdfPicking, setPdfPicking] = useState(false);

  const [preparing, setPreparing] = useState(false);
  const [error,     setError]     = useState("");

  // "Available for your class" — a proactive, browsable list shown
  // upfront, not a block. Fetched once on load from the same query the
  // main Materials page uses (board+grade+language), so it reflects
  // everything published for this student's group, admin-curated or
  // student-contributed alike.
  const [available,       setAvailable]       = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [showAvailable,   setShowAvailable]   = useState(false);
  const [importingId,     setImportingId]     = useState<string | null>(null);
  const [importedId,      setImportedId]      = useState<string | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  // "Get more from this page" grid — which material's extras panel is open,
  // and which specific kind is currently generating (so only that one
  // button shows a spinner, not the whole card).
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null); // `${materialId}:${kind}`

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = profile || await restoreStudentSession();
      if (cancelled) return;
      if (!p) { router.push("/login"); return; }
      if (!profile) {
        // Only reached when nothing was in localStorage at mount, so the
        // class/board/language selects above are still at their
        // hardcoded fallback defaults — safe to sync them to the
        // restored profile now.
        setProfile(p);
        setClassName(p.className || "IX");
        setSyllabus(p.syllabus || "cbse");
        setTargetLanguage(p.languageId || "english");
      }

      fetch(`/api/student/study-materials?studentId=${encodeURIComponent(p.email)}`)
        .then(r => r.json())
        .then(d => setMaterials(d.materials || []))
        .finally(() => setLoadingList(false));

      const params = new URLSearchParams({ board: p.syllabus, grade: p.grade });
      if (p.languageId) params.set("language", p.languageId);
      fetch(`/api/student/materials?${params.toString()}`)
        .then(r => r.json())
        .then(d => setAvailable(d.materials || []))
        .finally(() => setLoadingAvailable(false));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return null;

  async function importMaterial(m: any) {
    setImportingId(m.id);
    try {
      const res = await fetch("/api/student/study-materials/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: m.id, studentId: profile!.email, className }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMaterials(list => [data.material, ...list]);
      setImportedId(m.id);
    } catch (e: any) {
      setError(e.message || "Could not add this to your Classroom.");
    } finally {
      setImportingId(null);
    }
  }

  function fallbackDownloadUrl(materialId: string) {
    const p = new URLSearchParams();
    if (profile) { p.set("studentId", profile.email); p.set("email", profile.email); }
    return `/api/student/materials/${materialId}/download?${p.toString()}`;
  }

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError("");
    if (tbPreview) URL.revokeObjectURL(tbPreview);
    if (file.type === "application/pdf") {
      setTbFile(file); setTbPreview(null); setPdfPicking(true);
    } else {
      setTbFile(file); setTbPreview(URL.createObjectURL(file)); setPdfPicking(false);
    }
  }

  function handlePdfPageSelected(blob: Blob, pageNum: number) {
    const imgFile = new File([blob], `page-${pageNum}.jpg`, { type: "image/jpeg" });
    if (tbPreview) URL.revokeObjectURL(tbPreview);
    setTbFile(imgFile);
    setTbPreview(URL.createObjectURL(blob));
    setPdfPicking(false);
  }

  function clearFile() {
    if (tbPreview) URL.revokeObjectURL(tbPreview);
    setTbFile(null); setTbPreview(null); setPdfPicking(false);
  }

  // Hands the SAME uploaded file to Classroom's "Teach from textbook"
  // mode — reuses the exact sessionStorage handoff already built for the
  // PWA Share Target feature (app/share-target/route.ts), rather than
  // inventing a second mechanism. No re-upload, no new code path in
  // Classroom needed — it already knows how to consume this key.
  async function quickTeachInClassroom() {
    if (!tbFile) return;
    const arrayBuffer = await tbFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    sessionStorage.setItem("gg_shared_file", JSON.stringify({
      base64, name: tbFile.name, type: tbFile.type,
    }));
    router.push("/classroom?fromShare=1");
  }

  async function generateExtra(materialId: string, kind: ExtraMaterialKind) {
    const key = `${materialId}:${kind}`;
    setGeneratingKey(key);
    try {
      const res  = await fetch(`/api/student/study-materials/${materialId}/generate-extra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (res.ok) {
        setMaterials(list => list.map(m => (m.id === materialId ? data.material : m)));
      }
    } finally {
      setGeneratingKey(null);
    }
  }

  /** Prepend a freshly created material and, if the kitchen returned it
   *  partial (segment 1 only), kick stage-2 generation in the background —
   *  shared by the page's own prepare() and the TextbookShelf's
   *  Make Material flow, so both behave identically. */
  function adoptNewMaterial(material: StudyMaterial) {
    setMaterials(m => [material, ...m]);
    if (material.generationStatus === "partial") {
      fetch(`/api/student/study-materials/${material.id}/continue-generation`, { method: "POST" })
        .then(r => r.json())
        .then(more => {
          if (more.material) {
            setMaterials(list => list.map(x => x.id === material.id ? more.material : x));
          }
        })
        .catch(() => { /* the first segment is still there and usable either way */ });
    }
  }

  const [localStage, setLocalStage] = useState<"reading" | "generating" | "translating" | null>(null);
  // Share-with-other-students consent — see the card rendering below and
  // app/api/student/study-materials/[id]/share/route.ts. dismissedShareIds
  // is session-only (not persisted): declining once just hides the prompt
  // for this browsing session, it isn't a permanent "never ask again".
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [dismissedShareIds, setDismissedShareIds] = useState<Set<string>>(new Set());
  const [previewMaterial, setPreviewMaterial] = useState<any | null>(null);

  async function shareMaterial(id: string) {
    setSharingId(id);
    try {
      const res = await fetch(`/api/student/study-materials/${id}/share`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.material) {
        setMaterials(list => list.map(x => x.id === id ? data.material : x));
      }
    } catch {
      // A failed share attempt isn't worth its own error UI — the
      // prompt just stays up and the student can try again.
    } finally {
      setSharingId(null);
    }
  }

  async function prepare() {
    if (!tbFile) return;
    setPreparing(true); setError(""); setLocalStage(null);
    try {
      const fd = new FormData();
      fd.append("file", tbFile);
      fd.append("studentId", profile!.email);
      fd.append("className", className);
      fd.append("syllabus", syllabus);
      fd.append("subject", subject);
      fd.append("sourceLanguage", sourceLanguage);
      fd.append("targetLanguage", targetLanguage);

      let res  = await fetch("/api/student/study-materials", { method: "POST", body: fd });
      let data = await res.json();

      if (!res.ok) {
        // Server (Gemini) generation failed — try the on-device
        // fallback ONLY if both required local models are already
        // downloaded (see lib/client/local-material-fallback.ts).
        // There's no point starting a multi-minute local generation
        // attempt that's guaranteed to fail at step 1 because the
        // student never downloaded the models — fail fast with a
        // clear "go download these first" message instead.
        if (!(await canRunLocalMaterialFallback())) {
          throw new Error(
            (data.error || "Could not prepare this material.") +
            " (Offline fallback unavailable — download Brain2's camera mode and VibeThinker-3B in Settings to enable it.)"
          );
        }
        const imageBytes = await tbFile.arrayBuffer();
        const local = await generateSegmentLocally(
          imageBytes,
          { subject, className, syllabus, sourceLanguage, targetLanguage },
          setLocalStage,
        );
        const localFd = new FormData();
        localFd.append("file", tbFile);
        localFd.append("className", className);
        localFd.append("syllabus", syllabus);
        localFd.append("subject", subject);
        localFd.append("sourceLanguage", sourceLanguage);
        localFd.append("targetLanguage", targetLanguage);
        localFd.append("title", local.title);
        localFd.append("firstSegment", JSON.stringify(local.firstSegment));

        res  = await fetch("/api/student/study-materials/from-local", { method: "POST", body: localFd });
        data = await res.json();
      }

      if (!res.ok) throw new Error(data.error);

      // Segment 1 is ready — show it immediately, don't make the student
      // wait for the rest. Stage 2 continues in the background via
      // adoptNewMaterial. Deliberately not awaited before clearing the
      // "preparing" state — that's the entire point of splitting this
      // into two calls. (Locally-generated materials have no stage 2 —
      // adoptNewMaterial's continuation call is a no-op for those, since
      // generationStatus is already "complete".)
      adoptNewMaterial(data.material);
      clearFile();
    } catch (e: any) {
      setError(e.message || "Could not prepare this material. Try a clearer photo.");
    } finally {
      setPreparing(false); setLocalStage(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="The Kitchen"
        title="Study Materials"
        subtitle="Fill the form, upload your textbook PDF, and make AI study materials in your language — then teach it page-by-page in the Classroom."
      />

      {/* ── MY TEXTBOOKS — the form + upload + shelf. This is where the
          "add a textbook" provision now lives (moved here from the
          Classroom); the Classroom reads this same shelf to teach. ── */}
      <TextbookShelf
        student={profile.email}
        defaultSyllabus={profile.syllabus || "cbse"}
        defaultClass={profile.grade || "8"}
        defaultLanguage={profile.languageId || "english"}
        onMaterialCreated={adoptNewMaterial}
      />

      {/* ── Available for your class — a proactive, browsable list, never
          a block. Real textbook-page previews so a student can visually
          confirm it's really their textbook before choosing to reuse it
          instead of generating their own. ── */}
      {!loadingAvailable && available.length > 0 && (
        <Card className="mb-6">
          <button onClick={() => setShowAvailable(v => !v)}
            className="flex w-full items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-marigold" />
              <div className="font-display text-base text-chalk">
                {available.length} material{available.length !== 1 ? "s" : ""} already available for your class
              </div>
            </div>
            <span className="font-mono text-[10px] text-chalkdim">{showAvailable ? "Hide ▾" : "Show ▸"}</span>
          </button>

          {showAvailable && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-xs text-chalkdim">
                Someone may have already made what you need. Check the textbook page below to make
                sure it's really from your textbook before adding it — then you don't have to make
                your own. You can still prepare your own material for anything not listed here.
              </p>
              {available.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border border-board3 bg-board2 p-3">
                  {m.textbookPreviewUrl ? (
                    <img src={m.textbookPreviewUrl} alt="Textbook page" className="h-16 w-16 shrink-0 rounded-md object-cover border border-board3" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-board3 text-chalkdim">
                      <BookOpen size={16} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-chalk">{m.title}</div>
                    <div className="font-mono text-[10px] text-chalkdim">{m.subject}</div>
                  </div>
                  <button onClick={() => setPreviewMaterial(m)}
                    className="shrink-0 font-mono text-[10px] text-chalkdim underline decoration-dotted hover:text-marigold">
                    Preview pages
                  </button>
                  {importedId === m.id ? (
                    <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] text-marigold">
                      <CheckCircle2 size={12} /> Added
                    </span>
                  ) : m.sourceStudyMaterialId ? (
                    <button onClick={() => importMaterial(m)} disabled={importingId === m.id}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-marigold px-3 py-1.5 font-mono text-[10px] font-semibold text-board hover:bg-marigolddim disabled:opacity-50">
                      {importingId === m.id ? <Loader2 size={11} className="animate-spin" /> : "Add to Classroom"}
                    </button>
                  ) : (
                    <a href={fallbackDownloadUrl(m.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-board3 px-3 py-1.5 font-mono text-[10px] text-chalkdim hover:text-chalk hover:border-marigold/50">
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

      )}

      {previewMaterial && (
        <SharedMaterialPreviewModal
          material={previewMaterial}
          onClose={() => setPreviewMaterial(null)}
          confirming={importingId === previewMaterial.id}
          confirmLabel={previewMaterial.sourceStudyMaterialId ? "Yes, this is my textbook — add it" : "Yes, this is my textbook — download it"}
          onConfirm={() => {
            if (previewMaterial.sourceStudyMaterialId) {
              importMaterial(previewMaterial);
            } else {
              window.location.href = fallbackDownloadUrl(previewMaterial.id);
            }
            setPreviewMaterial(null);
          }}
        />      )}

      {/* ── Upload / prepare form ── */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <ChefHat size={16} className="text-marigold" />
          <div className="font-display text-base text-chalk">Prepare a new material</div>
        </div>

        <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Subject</div>
            <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
              value={subject} onChange={e => setSubject(e.target.value)}>
              {STUDY_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
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
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Syllabus</div>
            <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
              value={syllabus} onChange={e => setSyllabus(e.target.value)}>
              {BOARDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Language of textbook</div>
            <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
              value={sourceLanguage} onChange={e => setSourceLanguage(e.target.value)}>
              {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Language to learn in</div>
            <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
              value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}>
              {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
        </div>

        {/* File upload */}
        {!tbFile && (
          <div onClick={() => document.getElementById("study-file-input")?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-board3 bg-board2 p-8 text-center hover:border-marigold hover:bg-board3 transition-colors relative">
            <input id="study-file-input" type="file" accept="image/*,application/pdf"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={e => handleFile(e.target.files?.[0])} />
            <ImagePlus size={26} className="mx-auto mb-3 text-marigold" />
            <div className="text-sm text-chalkdim">Tap to upload a textbook page</div>
            <div className="mt-1 text-xs text-chalkdim opacity-60">JPG, PNG, or PDF · max 8 MB</div>
          </div>
        )}

        {pdfPicking && tbFile && (
          <PDFPagePicker file={tbFile} onPageSelected={handlePdfPageSelected} onCancel={clearFile} />
        )}

        {tbFile && tbPreview && !pdfPicking && (
          <div className="relative overflow-hidden rounded-xl border border-board3 bg-board2">
            <img src={tbPreview} alt="Textbook page" className="w-full max-h-72 object-contain block" />
            <button onClick={clearFile}
              className="absolute top-2 right-2 rounded-full border border-board3 bg-board p-1.5 text-chalkdim hover:text-terracotta">
              <X size={13} />
            </button>
          </div>
        )}

        {tbFile && !pdfPicking && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={prepare} disabled={preparing}>
              {preparing
                ? <><Loader2 size={14} className="animate-spin" /> {
                    localStage === "reading" ? "Reading the page (offline model)…"
                    : localStage === "generating" ? "Generating with VibeThinker-3B…"
                    : localStage === "translating" ? "Translating (offline model)…"
                    : "Preparing your material…"
                  }</>
                : <><ChefHat size={14} /> Prepare this material</>}
            </Button>
            <button onClick={quickTeachInClassroom} disabled={preparing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-board3 bg-board2 px-4 py-2.5 text-sm text-chalkdim hover:text-chalk hover:border-marigold/50 disabled:opacity-50 transition-colors">
              <Zap size={14} /> Just teach this now (don't save)
            </button>
          </div>
        )}

        {error && <div className="mt-3 text-sm text-terracotta">{error}</div>}
      </Card>

      {/* ── List of prepared materials ── */}
      <div className="mb-3 font-display text-base text-chalk">Your prepared materials</div>
      {loadingList && (
        <div className="flex items-center gap-2 py-6 text-sm text-chalkdim">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}
      {!loadingList && materials.length === 0 && (
        <Card><p className="text-sm text-chalkdim">Nothing prepared yet — upload a textbook page above to get started.</p></Card>
      )}
      <div className="flex flex-col gap-2">
        {materials.map(m => {
          const total = m.segments.length;
          const pct   = total > 0 ? Math.round((m.progress.unlockedIndex / total) * 100) : 0;
          const isExpanded = expandedId === m.id;
          const EXTRA_LABELS: { id: ExtraMaterialKind; label: string; emoji: string }[] = [
            { id: "flashcards", label: "Flashcards",   emoji: "🧠" },
            { id: "quiz",       label: "Extra Quiz",   emoji: "❓" },
            { id: "notes",      label: "Revision Notes", emoji: "📚" },
            { id: "mindmap",    label: "Mind Map",     emoji: "🗺️" },
          ];
          return (
            <Card key={m.id} className="py-3.5">
              <Link href={`/classroom/study/${m.id}`}>
                <div className="flex items-start justify-between gap-3 hover:opacity-80 transition-opacity">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-marigold shrink-0" />
                      <span className="text-sm font-medium text-chalk truncate">{m.title}</span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-chalkdim">
                      {m.subject} · Class {m.className} · {total} segment{total !== 1 ? "s" : ""}
                      {pct >= 100 && <span className="text-marigold"> · <CheckCircle2 size={9} className="inline" /> Complete</span>}
                      {m.generationStatus === "partial" && (
                        <span className="text-blue"> · Preparing more segments…</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-chalkdim shrink-0 mt-0.5" />
                </div>
                {/* mini progress bar */}
                <div className="mt-2.5 h-1 w-full rounded-full bg-board3 overflow-hidden">
                  <div className="h-full bg-marigold transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </Link>

              {/* ── Share with other students — explicit consent, asked
                  once per material, only when it's actually eligible
                  (complete + passed the automatic quality check + not
                  already shared). Nothing publishes without the
                  student choosing "Yes" here — see
                  app/api/student/study-materials/[id]/share/route.ts. ── */}
              {m.generationStatus === "complete" && m.qaReport?.status === "passed" && !m.publishedMaterialId && !dismissedShareIds.has(m.id) && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-leaf/30 bg-leaf/10 p-3">
                  <p className="text-xs text-chalk">
                    This passed our quality check — share it so other students in your class can use it too?
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => shareMaterial(m.id)} disabled={sharingId === m.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-leaf px-3 py-1.5 font-mono text-[10px] font-semibold text-board hover:bg-leaf/80 disabled:opacity-50">
                      {sharingId === m.id ? <Loader2 size={11} className="animate-spin" /> : null} Yes, share it
                    </button>
                    <button onClick={() => setDismissedShareIds(s => new Set(s).add(m.id))}
                      className="font-mono text-[10px] text-chalkdim hover:text-chalk">
                      Not now
                    </button>
                  </div>
                </div>
              )}
              {m.publishedMaterialId && (
                <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-leaf">
                  <CheckCircle2 size={11} /> Shared with other students — thank you!
                </div>
              )}

              {/* ── Get more from this page — the student-facing "grid of
                  generators", reusing the SAME uploaded image, no second
                  upload. Only shown if the image is actually available
                  (older materials or PDF-sourced ones may not have one). ── */}
              {m.textbookImageRef && (
                <div className="mt-3 border-t border-board3 pt-3">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    className="mb-2 font-mono text-[10px] text-chalkdim hover:text-marigold">
                    {isExpanded ? "▾ Hide" : "▸ Get more from this page"}
                  </button>
                  {isExpanded && (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {EXTRA_LABELS.map(e => {
                          const key = `${m.id}:${e.id}`;
                          const already = !!m.extras?.[e.id];
                          const isGenerating = generatingKey === key;
                          return (
                            <button
                              key={e.id}
                              onClick={() => generateExtra(m.id, e.id)}
                              disabled={isGenerating}
                              className={`rounded-lg border px-2.5 py-2 text-center text-xs transition-colors disabled:opacity-50 ${
                                already ? "border-marigold/40 bg-marigold/5 text-chalk" : "border-board3 text-chalkdim hover:border-marigold/40"
                              }`}>
                              {isGenerating ? <Loader2 size={12} className="animate-spin mx-auto" /> : (
                                <>
                                  <div>{e.emoji}</div>
                                  <div className="mt-0.5">{already ? "✓ " : ""}{e.label}</div>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Show whichever extras have been generated so far */}
                      {EXTRA_LABELS.filter(e => m.extras?.[e.id]).map(e => (
                        <div key={e.id} className="rounded-lg border border-board3 bg-board p-3 max-h-64 overflow-y-auto">
                          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-marigold">{e.emoji} {e.label}</div>
                          <pre className="whitespace-pre-wrap break-words font-body text-xs text-chalk leading-relaxed">
                            <MathText text={m.extras![e.id]!} />
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Premium gate (dunning flow) — while a subscription is DEGRADED this
 * page shows the renew card instead; full/grace render normally. Has no
 * effect while ENFORCE_SUBSCRIPTIONS is false (lib/dev-mode.ts).
 */
export default function GatedStudyMaterialsPage() {
  return <PremiumGate feature="Study Materials"><StudyMaterialsPage /></PremiumGate>;
}
