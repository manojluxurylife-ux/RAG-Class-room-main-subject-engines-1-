"use client";
import { useState } from "react";
import { Card, PageHeader, Button } from "@/components/ui";
import {
  Loader2, Sparkles, FileText, Presentation, ListChecks, Layers,
  GitBranch, FlaskConical, Mic, BookMarked, CheckCircle, Download,
} from "lucide-react";
import { THEME_PALETTES, type SlideDeck, type Slide } from "@/lib/slide-schema";
import {
  QUIZ_FORMATS, QUIZ_DIFFICULTIES, EXAM_STYLES, NOTES_SUBTYPES, LESSON_STYLES, MINDMAP_TYPES,
} from "@/lib/content-generators";
import { MathText } from "@/components/MathText";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

const KINDS = [
  { id: "lesson-plan",    label: "Lesson Plan",     icon: FileText,      desc: "Standard, story-based, or role-play delivery" },
  { id: "slides",         label: "Slide Deck",      icon: Presentation,  desc: "Real, colorful .pptx — vector diagrams, no images" },
  { id: "quiz",           label: "Quiz",            icon: ListChecks,    desc: "MCQ, Assertion-Reason, HOTS, case-study & more" },
  { id: "flashcards",     label: "Flash Cards",     icon: Layers,        desc: "Term/definition pairs, with optional mnemonics" },
  { id: "mind-map",       label: "Mind Map",        icon: GitBranch,     desc: "Concept map, dependency graph, or decision tree" },
  { id: "lab-manual",     label: "Lab Manual",      icon: FlaskConical,  desc: "Practical steps + materials list" },
  { id: "voice-script",   label: "Voice Script",    icon: Mic,           desc: "Narration script, or a role-play dialogue" },
  { id: "revision-notes", label: "Revision Notes",  icon: BookMarked,    desc: "Chapter summary, formula sheet, or full notes" },
] as const;

const SUBJECTS = ["Maths","Science","Social Studies","Language","General"];
const BOARDS   = [
  { id: "cbse",      label: "CBSE (NCERT)" },
  { id: "kerala",    label: "Kerala SCERT" },
  { id: "tamilnadu", label: "Tamil Nadu" },
  { id: "karnataka", label: "Karnataka" },
];
const GRADES   = ["6","7","8","9","10"];
const LANGUAGES = SUPPORTED_LANGUAGES.map(l => ({ id: l.id, label: l.label }));

type KindId = typeof KINDS[number]["id"];
type TextResult  = { title: string; content: string };
type SlideResult = {
  deck: SlideDeck;
  sizeBytes: number;
  gcsObjectName?: string;
  driveFileId?: string;
  driveViewLink?: string;
  storageBackend: "gcs-or-db" | "drive" | "none";
  storageWarning?: string;
};

export default function CreatorStudioPage() {
  const [kind,       setKind]       = useState<KindId>("lesson-plan");
  const [topic,      setTopic]      = useState("");
  const [subject,    setSubject]    = useState("Maths");
  const [boardId,    setBoardId]    = useState("cbse");
  const [grade,      setGrade]      = useState("8");
  const [languageId, setLanguageId] = useState("english");

  // Richer options — only relevant to specific kinds, shown conditionally below
  const [quizFormat,     setQuizFormat]     = useState("mcq");
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [examStyle,      setExamStyle]      = useState("standard");
  const [notesSubtype,   setNotesSubtype]   = useState("standard");
  const [lessonStyle,    setLessonStyle]    = useState("standard");
  const [mindmapType,    setMindmapType]    = useState("standard");
  const [includeMnemonics, setIncludeMnemonics] = useState(false);

  const [generating,  setGenerating]  = useState(false);
  const [textResult,  setTextResult]  = useState<TextResult | null>(null);
  const [slideResult, setSlideResult] = useState<SlideResult | null>(null);
  const [error,       setError]       = useState("");

  const [boards, setBoards] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]); // empty = all mediums/languages
  const [publishing, setPublishing] = useState(false);
  const [publishOk,  setPublishOk]  = useState(false);

  const isSlides = kind === "slides";

  async function generate() {
    if (!topic.trim()) return;
    setGenerating(true); setError(""); setTextResult(null); setSlideResult(null); setPublishOk(false);
    try {
      const endpoint = isSlides ? "/api/admin/generate-slides" : "/api/admin/generate";
      const res  = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSlides
          ? { topic: topic.trim(), subject, grade, boardId, languageId }
          : {
              kind, topic: topic.trim(), subject, grade, boardId, languageId,
              quizFormat, quizDifficulty, examStyle, notesSubtype, lessonStyle, mindmapType, includeMnemonics,
            }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (isSlides) setSlideResult(data); else setTextResult(data);
      setBoards([boardId]); setGrades([grade]);
    } catch (e: any) {
      setError(e.message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  function toggleBoard(id: string) {
    setBoards(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]);
  }
  function toggleGrade(g: string) {
    setGrades(gr => gr.includes(g) ? gr.filter(x => x !== g) : [...gr, g]);
  }
  function toggleTargetLanguage(id: string) {
    setTargetLanguages(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);
  }

  async function publish() {
    setPublishing(true);
    try {
      let body: any = null;
      if (isSlides && slideResult) {
        // storageBackend tells us where (if anywhere) the .pptx actually
        // landed — generation itself always succeeds now even when
        // storage doesn't (see /api/admin/generate-slides), so this has
        // to pick the right reference rather than assuming GCS.
        if (slideResult.storageBackend === "gcs-or-db" && slideResult.gcsObjectName) {
          body = {
            title: slideResult.deck.title, subject, boards, grades, languages: targetLanguages,
            source: "gcs", sourceRef: slideResult.gcsObjectName,
            fileType: "pptx", materialKind: "slides", sizeBytes: slideResult.sizeBytes,
          };
        } else if (slideResult.storageBackend === "drive" && slideResult.driveFileId) {
          body = {
            title: slideResult.deck.title, subject, boards, grades, languages: targetLanguages,
            source: "drive", sourceRef: slideResult.driveFileId,
            fileType: "pptx", materialKind: "slides", sizeBytes: slideResult.sizeBytes,
          };
        } else {
          throw new Error(slideResult.storageWarning || "This deck wasn't saved to any storage, so there's nothing to publish yet.");
        }
      } else if (textResult) {
        body = {
          title: textResult.title, subject, boards, grades, languages: targetLanguages,
          source: "generated", content: textResult.content, materialKind: kind,
        };
      }
      if (!body) return;

      const res = await fetch("/api/admin/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setPublishOk(true);
    } catch (e: any) {
      setError(e.message || "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  function downloadMd() {
    if (!textResult) return;
    const blob = new Blob([textResult.content], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${textResult.title}.md`; a.click();
    URL.revokeObjectURL(url);
  }

  const activeKind = KINDS.find(k => k.id === kind)!;
  const hasResult  = isSlides ? !!slideResult : !!textResult;

  return (
    <div>
      <PageHeader
        eyebrow="Admin · AI Tools"
        title="Creator Studio"
        subtitle="Generate lesson plans, slides, quizzes, flashcards, and more — then publish straight to the student materials library."
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">

        {/* ── LEFT: material type picker ── */}
        <div className="flex flex-col gap-2">
          {KINDS.map(k => (
            <button key={k.id} onClick={() => { setKind(k.id); setTextResult(null); setSlideResult(null); setPublishOk(false); }}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                kind === k.id
                  ? "border-marigold bg-marigold/10"
                  : "border-board3 bg-board2 hover:border-marigold/50"
              }`}>
              <k.icon size={18} className={kind === k.id ? "text-marigold shrink-0 mt-0.5" : "text-chalkdim shrink-0 mt-0.5"} />
              <div>
                <div className="text-sm font-medium text-chalk">{k.label}</div>
                <div className="mt-0.5 text-xs text-chalkdim leading-snug">{k.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* ── RIGHT: form + result ── */}
        <div>
          <Card className="mb-5">
            <div className="mb-4 flex items-center gap-2">
              <activeKind.icon size={16} className="text-marigold" />
              <div className="font-display text-lg text-chalk">{activeKind.label}</div>
            </div>

            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Topic</div>
            <input
              className="mb-4 w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk placeholder:text-chalkdim/60"
              placeholder="e.g. Quadratic Equations, Photosynthesis, Newton's Laws…"
              value={topic} onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === "Enter" && generate()} />

            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Subject</div>
                <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                  value={subject} onChange={e => setSubject(e.target.value)}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Board</div>
                <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                  value={boardId} onChange={e => setBoardId(e.target.value)}>
                  {BOARDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Class</div>
                <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                  value={grade} onChange={e => setGrade(e.target.value)}>
                  {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Language</div>
                <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                  value={languageId} onChange={e => setLanguageId(e.target.value)}>
                  {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
            </div>

            {/* ── Rich options — shown only for the kind they apply to ── */}
            {kind === "quiz" && (
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-board3 bg-board2 p-3">
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Question format</div>
                  <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                    value={quizFormat} onChange={e => setQuizFormat(e.target.value)}>
                    {QUIZ_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Difficulty</div>
                  <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                    value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)}>
                    {QUIZ_DIFFICULTIES.map(d => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Exam style</div>
                  <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                    value={examStyle} onChange={e => setExamStyle(e.target.value)}>
                    {EXAM_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {kind === "revision-notes" && (
              <div className="mb-4 rounded-lg border border-board3 bg-board2 p-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Notes type</div>
                <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                  value={notesSubtype} onChange={e => setNotesSubtype(e.target.value)}>
                  {NOTES_SUBTYPES.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
              </div>
            )}

            {kind === "mind-map" && (
              <div className="mb-4 rounded-lg border border-board3 bg-board2 p-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Map type</div>
                <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                  value={mindmapType} onChange={e => setMindmapType(e.target.value)}>
                  {MINDMAP_TYPES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                {(mindmapType === "dependency" || mindmapType === "decision-tree") && (
                  <p className="mt-1.5 font-mono text-[10px] text-marigold">Renders as a real Mermaid diagram, not just text</p>
                )}
              </div>
            )}

            {(kind === "lesson-plan" || kind === "voice-script") && (
              <div className="mb-4 rounded-lg border border-board3 bg-board2 p-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Delivery style</div>
                <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                  value={lessonStyle} onChange={e => setLessonStyle(e.target.value)}>
                  {LESSON_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            )}

            {kind === "flashcards" && (
              <label className="mb-4 flex items-center gap-2 rounded-lg border border-board3 bg-board2 p-3 cursor-pointer">
                <input type="checkbox" checked={includeMnemonics}
                  onChange={e => setIncludeMnemonics(e.target.checked)}
                  className="accent-marigold" />
                <span className="text-xs text-chalk">Include mnemonics on some cards</span>
              </label>
            )}

            <Button disabled={!topic.trim() || generating} onClick={generate}>
              {generating
                ? <><Loader2 size={14} className="animate-spin" /> {isSlides ? "Designing slides…" : "Generating…"}</>
                : <><Sparkles size={14} /> Generate {activeKind.label}</>}
            </Button>
            {error && <div className="mt-3 text-sm text-terracotta">{error}</div>}
          </Card>

          {/* ── Result: slide deck preview ── */}
          {isSlides && slideResult && (
            <Card className="mb-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <div className="font-display text-lg text-chalk">{slideResult.deck.title}</div>
                  <div className="font-mono text-[10px] text-chalkdim mt-0.5">
                    {slideResult.deck.slides.length} slides · {(slideResult.sizeBytes / 1024).toFixed(0)} KB · theme: {slideResult.deck.theme}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
                {slideResult.deck.slides.map((s, i) => (
                  <SlidePreviewCard key={i} slide={s} theme={slideResult.deck.theme} index={i + 1} />
                ))}
              </div>

              {/* Storage status — generation always succeeds now even when
                  GCS/Drive don't; this just tells the admin what happened
                  so it isn't a silent surprise when Publish is disabled. */}
              {slideResult.storageBackend === "drive" && (
                <div className="mt-3 text-xs text-chalkdim">
                  GCS isn't configured — saved to the admin Google Drive folder instead.{" "}
                  {slideResult.driveViewLink && (
                    <a href={slideResult.driveViewLink} target="_blank" rel="noreferrer" className="underline">View in Drive</a>
                  )}
                </div>
              )}
              {slideResult.storageBackend === "none" && (
                <div className="mt-3 text-xs text-terracotta">{slideResult.storageWarning}</div>
              )}
            </Card>

          )}

          {/* ── Result: text-based materials ── */}
          {!isSlides && textResult && (
            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="font-display text-lg text-chalk">{textResult.title}</div>
                <button onClick={downloadMd}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-board3 bg-board2 px-3 py-1.5 text-xs text-chalkdim hover:text-chalk hover:border-marigold/50">
                  <Download size={12} /> .md
                </button>
              </div>
              <div className="mb-5 max-h-[480px] overflow-y-auto rounded-lg border border-board3 bg-board p-4">
                <pre className="whitespace-pre-wrap break-words font-body text-sm text-chalk leading-relaxed">
                  <MathText text={textResult.content} />
                </pre>
              </div>
            </Card>
          )}

          {/* ── Publish controls (shared) ── */}
          {hasResult && (
            <Card>
              <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-chalkdim">
                Publish to boards (toggle to override)
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {BOARDS.map(b => (
                  <button key={b.id} onClick={() => toggleBoard(b.id)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      boards.includes(b.id) ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                    }`}>
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {GRADES.map(g => (
                  <button key={g} onClick={() => toggleGrade(g)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      grades.includes(g) ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                    }`}>
                    Class {g}
                  </button>
                ))}
              </div>

              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">
                Medium / language (leave empty = all mediums)
              </div>
              <p className="mb-2 text-[10px] text-chalkdim">
                e.g. a Class VI Tamil-medium worksheet — select Tamil here so only Tamil-medium
                students in that class see it, not the whole class.
              </p>
              <div className="mb-5 flex flex-wrap gap-2">
                {LANGUAGES.map(l => (
                  <button key={l.id} onClick={() => toggleTargetLanguage(l.id)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      targetLanguages.includes(l.id) ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                    }`}>
                    {l.label}
                  </button>
                ))}
              </div>

              <Button onClick={publish} disabled={publishing || boards.length === 0 || grades.length === 0 || (isSlides && slideResult?.storageBackend === "none")}>
                {publishing ? <><Loader2 size={14} className="animate-spin" /> Publishing…</> : "Publish to students"}
              </Button>

              {publishOk && (
                <div className="mt-3 flex items-center gap-2 text-sm text-marigold">
                  <CheckCircle size={14} /> Published — visible in Study Materials for the selected board(s) and class(es).
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Slide preview card — mirrors the actual .pptx theme so what you see
// here genuinely reflects what students will get, without re-rendering
// the real pptx in-browser. ──
function SlidePreviewCard({ slide, theme, index }: { slide: Slide; theme: keyof typeof THEME_PALETTES; index: number }) {
  const p = THEME_PALETTES[theme];
  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: `#${p.bgAccent}`, background: `#${p.bg}` }}>
      <div className="h-1" style={{ background: `#${p.primary}` }} />
      <div className="p-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {slide.emoji && <span>{slide.emoji}</span>}
            <span className="text-sm font-semibold" style={{ color: `#${p.primary}` }}>{slide.heading}</span>
          </div>
          <span className="font-mono text-[9px] uppercase" style={{ color: `#${p.text}`, opacity: 0.5 }}>
            {index} · {slide.kind}
          </span>
        </div>

        {slide.bullets && slide.bullets.length > 0 && (
          <ul className="mb-2 pl-4 text-xs space-y-0.5" style={{ color: `#${p.text}` }}>
            {slide.bullets.slice(0, 6).map((b, i) => <li key={i} className="list-disc">{b}</li>)}
          </ul>
        )}

        {slide.diagram && (
          <div className="mb-2 rounded border px-2 py-1.5 font-mono text-[10px]"
            style={{ borderColor: `#${p.secondary}`, color: `#${p.secondary}` }}>
            📊 {slide.diagram.type} diagram — {slide.diagram.items?.length || slide.diagram.rows?.length || 0} items
          </div>
        )}

        {slide.callouts && slide.callouts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {slide.callouts.map((c, i) => (
              <div key={i} className="rounded px-2 py-1 text-[10px]" style={{ background: `#${p.bgAccent}`, color: `#${p.text}` }}>
                <b style={{ color: `#${p.secondary}` }}>{c.label}:</b> {c.text}
              </div>
            ))}
          </div>
        )}

        {slide.kind === "quiz" && (
          <div className="rounded px-2 py-1.5 text-xs" style={{ background: `#${p.bgAccent}`, color: `#${p.text}` }}>
            <div>❓ {slide.quizQuestion}</div>
            {slide.quizAnswer && <div className="mt-1 italic opacity-70">Answer: {slide.quizAnswer}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
