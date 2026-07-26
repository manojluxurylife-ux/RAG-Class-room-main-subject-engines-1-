"use client";
/**
 * The "dining room" — where a prepared study material (from the Kitchen,
 * /study-materials) actually gets taught, segment by segment, with a
 * YouTube-style progress bar.
 *
 * Quiz gating is a per-student toggle (Settings → Study Materials pacing,
 * lib/student-session.ts's quizGatingEnabled — defaults to true).
 *   ON  (default): rewinding to any already-unlocked segment is always
 *        allowed; advancing past the furthest unlocked segment requires
 *        answering that segment's quiz correctly first.
 *   OFF: free navigation to any segment at any time. A big enough real-
 *        world reason to build this rather than always-gate: if this
 *        launches with mandatory gating, a student whose in-app pace has
 *        fallen behind their actual school lessons would be stuck unable
 *        to reach the chapter their teacher is covering today — a real
 *        adoption blocker, not just a nice-to-have preference. Quizzes
 *        still show when gating is off (useful self-checks), they just
 *        don't block anything.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ArrowLeft, ArrowRight, Lock, CheckCircle2, BookOpen, Play, Unlock,
} from "lucide-react";
import { Card } from "@/components/ui";
import { studentSession } from "@/lib/student-session";
import { restoreStudentSession } from "@/lib/client/restore-student-session";
import type { StudyMaterial, StudySegment } from "@/lib/study-material-schema";
import { LiveVisualizationPlayer } from "@/components/visuals/LiveVisualizationPlayer";
import { Typewriter } from "@/components/Typewriter";
import { TextbookTeachingView } from "@/components/TextbookTeachingView";
import { fetchBlobForOffline, getOfflineStudyCourse, saveStudyCourse } from "@/lib/offline-materials";

type Line = { id: string; section: "point" | "ex-problem" | "ex-step" | "ex-answer"; text: string; idx: number };

// Same flattening pattern as the ad-hoc lesson board (classroom/page.tsx's
// buildLines()) — this is what Spotlight actually attaches to: without a
// typed, sequential reveal, there's no "currently teaching" line for a
// glow to follow, only a static block of text. Found missing entirely
// here on audit; carried over to match, not reinvented.
function buildSegmentLines(segment: StudySegment | undefined): Line[] {
  if (!segment) return [];
  const raw: Omit<Line, "idx">[] = [];
  segment.points.forEach((t, i) => raw.push({ id: `point-${i}`, section: "point", text: t }));
  if (segment.example) {
    raw.push({ id: "ex-problem", section: "ex-problem", text: segment.example.problem });
    segment.example.steps.forEach((t, i) => raw.push({ id: `ex-step-${i}`, section: "ex-step", text: t }));
    raw.push({ id: "ex-answer", section: "ex-answer", text: segment.example.answer });
  }
  return raw.map((l, idx) => ({ ...l, idx }));
}

export default function StudyMaterialPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [material,   setMaterial]   = useState<StudyMaterial | null>(null);
  const [imageUrl,    setImageUrl]  = useState<string | null>(null);
  const [loading,     setLoading]   = useState(true);
  const [error,       setError]     = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [typedCount,  setTypedCount]  = useState(0);   // drives the typewriter reveal + Spotlight on this segment
  const [gatingEnabled, setGatingEnabled] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  // Quiz state for the currently viewed segment
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<"correct" | "wrong" | null>(null);
  const [advancing, setAdvancing]   = useState(false);

  useEffect(() => {
    (async () => {
      if (!(await restoreStudentSession())) { router.push("/login"); return; }
      setGatingEnabled(studentSession.isQuizGatingEnabled());
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Restart the typewriter/Spotlight fresh every time the viewed segment
  // changes — whether from seeking, advancing, or the initial load.
  useEffect(() => {
    setTypedCount(0);
  }, [activeIndex]);

  async function load() {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/student/study-materials/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMaterial(data.material);
      setImageUrl(data.textbookImageUrl);
      setOfflineMode(false);
      // Preserve both structured lesson data and the textbook page on this device.
      const textbookBlob = await fetchBlobForOffline(data.textbookImageUrl);
      saveStudyCourse({ material: data.material, textbookBlob, textbookMimeType: data.material.textbookMimeType }).catch(() => {});
      setActiveIndex(Math.min(data.material.progress.unlockedIndex, data.material.segments.length - 1));
    } catch (e: any) {
      try {
        const cached = await getOfflineStudyCourse(id);
        if (!cached) throw e;
        setMaterial(cached.data);
        setOfflineMode(true);
        if (cached.textbookBlob) setImageUrl(URL.createObjectURL(cached.textbookBlob));
        else setImageUrl(null);
        setActiveIndex(Math.min(cached.data.progress?.unlockedIndex || 0, cached.data.segments.length - 1));
      } catch {
        setError(e.message || "Could not load this material. Open it once online to save an offline copy.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 py-16 text-chalkdim"><Loader2 size={18} className="animate-spin" /> Loading…</div>;
  }
  if (error || !material) {
    return (
      <div>
        <Card><p className="text-sm text-terracotta">{error || "Material not found."}</p></Card>
        <Link href="/study-materials" className="mt-3 inline-block text-xs text-chalkdim hover:text-chalk">← Back to Study Materials</Link>
      </div>
    );
  }

  const segments      = material.segments;
  const segment: StudySegment = segments[activeIndex];
  const unlockedIndex  = material.progress.unlockedIndex;
  // When gating is off, every segment is treated as reachable.
  const isUnlocked     = (i: number) => !gatingEnabled || i <= unlockedIndex;
  const segmentDone    = material.progress.completedSegmentIds.includes(segment.id);
  const isLastSegment  = activeIndex === segments.length - 1;

  const lines       = buildSegmentLines(segment);
  const pointLines   = lines.filter(l => l.section === "point");
  const exampleLines = lines.filter(l => l.section.startsWith("ex-"));

  // Same isActive/spotlight pattern as the ad-hoc lesson board — the line
  // currently typing gets the glow, finished lines dim to ~55% opacity.
  function typedLine(line: Line | undefined, wrap: (c: React.ReactNode, isActive: boolean) => React.ReactNode) {
    if (!line || line.idx > typedCount) return null;
    const isActive = line.idx === typedCount;
    const content = line.idx < typedCount ? (
      line.text
    ) : (
      <Typewriter text={line.text} speed={16} onDone={() => setTypedCount(c => c + 1)} />
    );
    return wrap(content, isActive);
  }

  const exStarted = exampleLines.length > 0 && typedCount >= exampleLines[0].idx;
  const activeCue = segment.textbookCues?.[Math.min(typedCount, Math.max(0, lines.length - 1))];

  async function seekTo(i: number) {
    if (!isUnlocked(i)) return;
    setActiveIndex(i);
    setSelectedOption(null); setQuizResult(null);

    // Free-navigation mode: record the furthest reached point for resume,
    // without going through the gated advance() flow.
    if (!gatingEnabled && i > unlockedIndex && material) {
      if (offlineMode) {
        const updated = { ...material, progress: { ...material.progress, unlockedIndex: i } };
        setMaterial(updated);
        saveStudyCourse({ material: updated }).catch(() => {});
      } else {
        try {
          const res  = await fetch(`/api/student/study-materials/${id}/advance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetIndex: i }),
          });
          const data = await res.json();
          if (res.ok) { setMaterial(data.material); saveStudyCourse({ material: data.material }).catch(() => {}); }
        } catch { /* non-critical */ }
      }
    }
  }

  async function completeSegmentAndAdvance() {
    if (offlineMode && material) {
      const completed = Array.from(new Set([...material.progress.completedSegmentIds, segment.id]));
      const nextIndex = Math.min(activeIndex + 1, segments.length - 1);
      const updated = { ...material, progress: { ...material.progress, completedSegmentIds: completed, unlockedIndex: Math.max(material.progress.unlockedIndex, nextIndex) } };
      setMaterial(updated);
      await saveStudyCourse({ material: updated }).catch(() => {});
      if (activeIndex < segments.length - 1) { setActiveIndex(nextIndex); setSelectedOption(null); setQuizResult(null); }
      return;
    }
    setAdvancing(true);
    try {
      const res  = await fetch(`/api/student/study-materials/${id}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId: segment.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMaterial(data.material);
        saveStudyCourse({ material: data.material }).catch(() => {});
        if (activeIndex < segments.length - 1) {
          setActiveIndex(activeIndex + 1);
          setSelectedOption(null); setQuizResult(null);
        }
      }
    } finally {
      setAdvancing(false);
    }
  }

  // Free-navigation mode: just move on, no server call needed since the
  // furthest-reached marker only matters for gated resume — but keep it
  // in sync anyway via seekTo's own jump logic.
  function goToNextFreely() {
    if (activeIndex < segments.length - 1) seekTo(activeIndex + 1);
  }

  function submitQuiz() {
    if (selectedOption === null || !segment.quiz) return;
    const isCorrect = selectedOption === segment.quiz.correctIndex;
    setQuizResult(isCorrect ? "correct" : "wrong");

    // Fire-and-forget — never blocks the UI on this; the quiz result
    // display already happened above, this just logs it for /progress.
    if (!offlineMode) {
      fetch(`/api/student/study-materials/${id}/quiz-attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentId: segment.id,
          segmentHeading: segment.heading,
          question: segment.quiz.question,
          correct: isCorrect,
          bloomsLevel: segment.quiz.bloomsLevel,
        }),
      }).catch(() => { /* non-critical */ });
    }
  }

  return (
    <div>
      <Link href="/study-materials" className="mb-4 inline-flex items-center gap-1.5 text-xs text-chalkdim hover:text-chalk">
        <ArrowLeft size={12} /> Back to Study Materials
      </Link>

      <div className="mb-1 flex items-center gap-2">
        <BookOpen size={16} className="text-marigold" />
        <h1 className="font-display text-xl text-chalk">{material.title}</h1>
        {!gatingEnabled && (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue/40 px-2 py-0.5 font-mono text-[9px] text-blue">
            <Unlock size={9} /> Free navigation
          </span>
        )}
        {offlineMode && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 px-2 py-0.5 font-mono text-[9px] text-amber">
            Offline replay
          </span>
        )}
      </div>
      <div className="mb-5 font-mono text-[10px] text-chalkdim">
        {material.subject} · Class {material.className}
      </div>

      {/* ── YouTube-style seek bar ── */}
      <div className="mb-6">
        <div className="flex gap-1 h-2.5 rounded-full overflow-hidden">
          {segments.map((s, i) => (
            <button
              key={s.id}
              onClick={() => seekTo(i)}
              disabled={!isUnlocked(i)}
              title={isUnlocked(i) ? s.heading : "Locked — finish the current segment first"}
              className={`flex-1 transition-all ${
                i === activeIndex
                  ? "bg-marigold"
                  : material.progress.completedSegmentIds.includes(s.id)
                  ? "bg-marigold/60 hover:bg-marigold/80"
                  : isUnlocked(i)
                  ? "bg-blue/50 hover:bg-blue/70 cursor-pointer"
                  : "bg-board3 cursor-not-allowed"
              }`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-chalkdim">
          <span>Segment {activeIndex + 1} of {segments.length}{material.generationStatus === "partial" ? "+" : ""}</span>
          <span className="flex items-center gap-1">
            {material.generationStatus === "partial" && isLastSegment && (
              <><Loader2 size={9} className="animate-spin" /> More segments being prepared…</>
            )}
            {gatingEnabled && !isUnlocked(activeIndex + 1) && activeIndex < segments.length - 1 && (
              <><Lock size={9} /> Finish this to unlock the next</>
            )}
          </span>
        </div>
      </div>

      {/* ── Split view: textbook page + segment content ── */}
      <div className={imageUrl ? "grid gap-5 md:grid-cols-2 md:items-start mb-6" : "mb-6"}>
        {imageUrl && (
          <div className="overflow-hidden rounded-xl border border-board3 bg-board2">
            <TextbookTeachingView url={imageUrl} mimeType={material.textbookMimeType} cue={activeCue} />
            <div className="border-t border-board3 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-chalkdim">
              🔦 AI textbook focus · 🔴 laser pointer
            </div>
          </div>
        )}

        <Card>
          <h2 className="font-display text-xl text-chalk mb-3">{segment.heading}</h2>

          <ul className="mb-5 flex flex-col gap-1.5 list-none p-0">
            {pointLines.map(l => typedLine(l, (c, isActive) => (
              <li key={l.id}
                className={`text-sm pl-4 relative -mx-2 px-2 py-1.5 rounded-lg before:content-['—'] before:absolute before:left-2 before:text-marigold transition-all duration-300 ${
                  isActive
                    ? "bg-marigold/10 text-chalk shadow-[0_0_18px_rgba(232,163,61,0.15)]"
                    : "text-chalk/55"
                }`}>
                {c}
              </li>
            )))}
          </ul>

          {exStarted && segment.example && (
            <div className="mb-4 rounded-lg border border-dashed border-board3 p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-terracotta">Worked example</div>
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

          {!!(segment.visualizationPlan || segment.visual) && (
            <LiveVisualizationPlayer
              plan={segment.visualizationPlan}
              legacyVisual={segment.visual}
              completedTeachingLines={typedCount}
            />
          )}

          {/* ── Quiz — gate when enabled, self-check only when not ── */}
          {segment.quiz && (
            <div className="border-t border-board3 pt-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-marigold">
                {segmentDone ? "✓ Quiz passed" : gatingEnabled ? "Answer to continue" : "Quick check (optional)"}
              </div>
              <div className="mb-3 text-sm text-chalk">{segment.quiz.question}</div>
              <div className="flex flex-col gap-2 mb-3">
                {segment.quiz.options.map((opt, i) => (
                  <button key={i}
                    onClick={() => { if (!segmentDone) { setSelectedOption(i); setQuizResult(null); } }}
                    disabled={segmentDone}
                    className={`text-left rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                      segmentDone && i === segment.quiz!.correctIndex
                        ? "border-marigold bg-marigold/10 text-chalk"
                        : selectedOption === i
                        ? "border-marigold bg-marigold/10 text-chalk"
                        : "border-board3 text-chalkdim hover:border-marigold/40"
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
              {quizResult === "wrong" && (
                <div className="mb-3 text-xs text-terracotta">Not quite — try again.</div>
              )}
              {!segmentDone && (
                <button onClick={submitQuiz} disabled={selectedOption === null}
                  className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-board hover:bg-marigolddim disabled:opacity-50">
                  Check answer
                </button>
              )}

              {/* Gated mode: Next only appears once the quiz is passed */}
              {gatingEnabled && (quizResult === "correct" || segmentDone) && !isLastSegment && (
                <button onClick={completeSegmentAndAdvance} disabled={advancing}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-board hover:bg-marigolddim disabled:opacity-50">
                  {advancing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} Next segment
                </button>
              )}

              {/* Free-navigation mode: Next always available, quiz is just a self-check */}
              {!gatingEnabled && !isLastSegment && (
                <button onClick={goToNextFreely}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-board3 bg-board2 px-4 py-2 text-sm text-chalkdim hover:text-chalk hover:border-marigold/50">
                  <ArrowRight size={14} /> Next segment
                </button>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── Navigation for segments without a quiz ── */}
      {!segment.quiz && (
        <div className="flex items-center justify-between">
          <button onClick={() => seekTo(activeIndex - 1)} disabled={activeIndex === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-board3 px-4 py-2 text-sm text-chalkdim hover:text-chalk disabled:opacity-30">
            <ArrowLeft size={14} /> Previous
          </button>

          {!isLastSegment ? (
            gatingEnabled ? (
              <button onClick={completeSegmentAndAdvance} disabled={advancing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-marigold px-5 py-2.5 text-sm font-semibold text-board hover:bg-marigolddim disabled:opacity-50">
                {advancing ? <Loader2 size={14} className="animate-spin" /> : <><Play size={14} /> Next segment</>}
              </button>
            ) : (
              <button onClick={goToNextFreely}
                className="inline-flex items-center gap-1.5 rounded-lg bg-marigold px-5 py-2.5 text-sm font-semibold text-board hover:bg-marigolddim">
                <Play size={14} /> Next segment
              </button>
            )
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-marigold/40 px-4 py-2.5 text-sm text-marigold">
              <CheckCircle2 size={14} /> {segmentDone || unlockedIndex >= segments.length - 1 ? "Course complete" : "Last segment"}
            </div>
          )}
        </div>
      )}

      {/* Previous button when a quiz IS present (kept separate to not clash with the quiz's own Next button) */}
      {segment.quiz && activeIndex > 0 && (
        <button onClick={() => seekTo(activeIndex - 1)}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-chalkdim hover:text-chalk">
          <ArrowLeft size={12} /> Previous segment
        </button>
      )}
    </div>
  );
}
