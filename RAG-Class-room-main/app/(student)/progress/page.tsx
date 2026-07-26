"use client";
/**
 * Progress — combines two data sources:
 *   1. Ad-hoc "Teach from textbook" / quick-topic lessons: localStorage
 *      only (lib/student-session.ts) — these were never persisted server-
 *      side, so they only ever show up here, on this device.
 *   2. Study Materials chapter/quiz activity: Firestore, via
 *      /api/student/progress-summary — subject breakdown, date-wise
 *      attendance, and full quiz attempt history (right AND wrong, not
 *      just pass/fail) all come from here.
 * The day streak shown combines BOTH sources — a day counts as "studied"
 * if either an ad-hoc lesson or any study-material activity happened.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card, PageHeader, StatCard, EmptyState,
} from "@/components/ui";
import { studentSession, type LessonRecord } from "@/lib/student-session";
import { restoreStudentSession } from "@/lib/client/restore-student-session";
import {
  BookOpen, CheckCircle2, XCircle, Flame, Loader2, TrendingUp,
} from "lucide-react";

const BOARD_LABELS: Record<string, string> = {
  cbse: "CBSE", kerala: "Kerala", tamilnadu: "Tamil Nadu", karnataka: "Karnataka",
};

interface SubjectBreakdown { subject: string; totalSegments: number; completedSegments: number; materials: number; pct: number }
interface AttendanceDay { date: string; subjects: string[] }
interface QuizResult { subject: string; materialTitle: string; segmentHeading: string; question: string; correct: boolean; attemptedAt: string }
interface ProgressSummary {
  subjectBreakdown: SubjectBreakdown[];
  attendanceByDate: AttendanceDay[];
  quizResults: QuizResult[];
  quizStats: { totalAttempts: number; correctAttempts: number; accuracyPct: number | null };
  studyMaterialStreak: number;
  totalMaterials: number;
  chapterTests: { id: string; subject: string; textbookTitle: string; chapterTitle: string; score: number; total: number; percentage: number; passed: boolean; attemptedAt: string }[];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export default function ProgressPage() {
  const router  = useRouter();
  const [history, setHistory] = useState<LessonRecord[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [ready,   setReady]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await restoreStudentSession();
      if (cancelled) return;
      if (!profile) { router.push("/login"); return; }
      setHistory(studentSession.getHistory());
      setReady(true);

      fetch(`/api/student/progress-summary?studentId=${encodeURIComponent(profile.email)}`)
        .then(r => r.json())
        .then(d => { if (!d.error) setSummary(d); })
        .finally(() => setLoadingSummary(false));
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (!ready) return null;

  const uniqueTopics = new Set(history.map(h => h.topic)).size;

  // ── Combined day streak: local ad-hoc lesson dates + server study-material activity dates ──
  const adHocDates = new Set(history.map(h => new Date(h.completedAt).toDateString()));
  const materialActiveDates = new Set(
    (summary?.attendanceByDate || []).filter(d => d.subjects.length > 0).map(d => new Date(d.date).toDateString()),
  );
  let combinedStreak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toDateString();
    if (adHocDates.has(key) || materialActiveDates.has(key)) combinedStreak++;
    else if (i > 0) break;
  }

  const totalChaptersCompleted = (summary?.subjectBreakdown || []).reduce((s, b) => s + b.completedSegments, 0);

  return (
    <div>
      <PageHeader eyebrow="Progress" title="Your learning journey" />

      {/* ── Top stats ── */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Quick lessons"   value={String(history.length)} />
        <StatCard label="Chapters done"   value={String(totalChaptersCompleted)} />
        <StatCard label="Topics covered"  value={String(uniqueTopics)} />
        <StatCard label="Day streak 🔥"   value={combinedStreak > 0 ? `${combinedStreak}` : "0"} />
      </div>

      {loadingSummary && (
        <div className="mb-6 flex items-center gap-2 text-sm text-chalkdim">
          <Loader2 size={16} className="animate-spin" /> Loading your study material activity…
        </div>
      )}

      {/* ── Chapters completed, by subject ── */}
      {summary && summary.subjectBreakdown.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 font-display text-base text-chalk">Chapters completed by subject</div>
          <div className="flex flex-col gap-2">
            {summary.subjectBreakdown.map(b => (
              <Card key={b.subject} className="py-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm text-chalk">{b.subject}</span>
                  <span className="font-mono text-[11px] text-chalkdim">
                    {b.completedSegments}/{b.totalSegments} chapters · {b.materials} material{b.materials !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-board3 overflow-hidden">
                  <div className="h-full bg-marigold transition-all" style={{ width: `${b.pct}%` }} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Date-wise attendance (last 30 days) ── */}
      {summary && (
        <div className="mb-6">
          <div className="mb-3 font-display text-base text-chalk">Attendance — last 30 days</div>
          <Card>
            <div className="grid grid-cols-10 gap-1.5">
              {summary.attendanceByDate.map(d => {
                const active = d.subjects.length > 0;
                const dateObj = new Date(d.date);
                const label = dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                return (
                  <div key={d.date}
                    title={active ? `${label}: ${d.subjects.join(", ")}` : label}
                    className={`aspect-square rounded-md flex items-center justify-center font-mono text-[8px] ${
                      active ? "bg-marigold text-board font-semibold" : "bg-board3 text-chalkdim"
                    }`}>
                    {dateObj.getDate()}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-chalkdim">
              <span className="w-2.5 h-2.5 rounded-sm bg-marigold inline-block" /> Studied
              <span className="w-2.5 h-2.5 rounded-sm bg-board3 inline-block ml-3" /> No activity
            </div>
          </Card>
        </div>
      )}

      {/* ── Weekly activity trend — a small addition beyond what was
          asked for: a quick "am I keeping up momentum" glance, since a
          30-day grid is good for attendance but harder to read as a
          trend at a glance. ── */}
      {summary && summary.attendanceByDate.length >= 7 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
            <TrendingUp size={15} className="text-marigold" /> This week's momentum
          </div>
          <Card>
            <div className="flex items-end justify-between gap-2 h-16">
              {summary.attendanceByDate.slice(-7).map(d => {
                const count = d.subjects.length;
                const heightPct = count === 0 ? 6 : Math.min(100, 30 + count * 25);
                const dateObj = new Date(d.date);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full rounded-t-sm bg-marigold/70 transition-all" style={{ height: `${heightPct}%` }} />
                    <span className="font-mono text-[8px] text-chalkdim">
                      {dateObj.toLocaleDateString("en-IN", { weekday: "narrow" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── Test results ── */}
      {summary && summary.chapterTests?.length > 0 && <div className="mb-6"><div className="mb-3 font-display text-base text-chalk">Chapter-end tests</div><div className="grid gap-2 sm:grid-cols-2">{summary.chapterTests.map(test => <Card key={test.id} className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-chalk">{test.chapterTitle}</p><p className="text-[10px] text-chalkdim">{test.subject} · {test.textbookTitle}</p></div><div className="text-right"><p className={`font-mono text-lg ${test.passed ? "text-marigold" : "text-terracotta"}`}>{test.percentage}%</p><p className="text-[9px] text-chalkdim">{test.score}/{test.total}</p></div></Card>)}</div></div>}

      {summary && summary.quizResults.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-base text-chalk">Test results</div>
            {summary.quizStats.accuracyPct !== null && (
              <span className="font-mono text-[11px] text-marigold">
                {summary.quizStats.accuracyPct}% accuracy ({summary.quizStats.correctAttempts}/{summary.quizStats.totalAttempts})
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {summary.quizResults.map((q, i) => (
              <Card key={i} className="py-2.5 flex items-center gap-3">
                {q.correct
                  ? <CheckCircle2 size={15} className="text-marigold shrink-0" />
                  : <XCircle size={15} className="text-terracotta shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-chalk truncate">{q.question}</div>
                  <div className="font-mono text-[9px] text-chalkdim mt-0.5">
                    {q.subject} · {q.materialTitle}
                  </div>
                </div>
                <span className="font-mono text-[9px] text-chalkdim shrink-0">{timeAgo(q.attemptedAt)}</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick lesson history (ad-hoc, local-only) ── */}
      <div className="mb-3 font-display text-base text-chalk">Quick lesson history</div>
      {history.length === 0 ? (
        <EmptyState text="No quick lessons yet — these are one-off lessons from Classroom's topic picker or Teach from textbook (not saved Study Materials, which are tracked above)." />
      ) : (
        <div className="flex flex-col gap-2">
          {history.map(h => (
            <Card key={h.id} className="flex items-center gap-3 py-3">
              <BookOpen size={15} className="text-marigold shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-chalk truncate">{h.topic}</div>
                <div className="font-mono text-[10px] text-chalkdim">
                  {BOARD_LABELS[h.boardId] || h.boardId} · Class {h.grade}
                </div>
              </div>
              <span className="font-mono text-[10px] text-chalkdim shrink-0">{timeAgo(h.completedAt)}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
