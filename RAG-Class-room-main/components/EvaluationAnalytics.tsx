"use client";
/**
 * EvaluationAnalytics — the eight-analytics view, extracted verbatim
 * from the parent portal's child-progress page so it renders IDENTICALLY
 * in both places it now lives:
 *   • app/parent/children/[childId]  (the parent portal)
 *   • app/(student)/parent-corner    (Parent's Corner inside the student app)
 * One view, one set of wordings, no drift.
 */
import { Card } from "@/components/ui";
import {
  Target, BookOpen, TrendingDown, CalendarClock, Gauge, Layers,
} from "lucide-react";
import type { ChildAnalytics } from "@/lib/child-analytics";
import { SubjectMasteryChart, BloomsChart, ReadinessDonut } from "@/components/AnalyticsCharts";

const BLOOMS_LABELS: Record<string, string> = {
  remember: "Remember", understand: "Understand", apply: "Apply",
  analyze: "Analyze", evaluate: "Evaluate", create: "Create",
};

const READINESS_COLOR: Record<string, string> = {
  "On Track": "text-marigold border-marigold/40 bg-marigold/10",
  "Needs More Practice": "text-blue border-blue/40 bg-blue/10",
  "Needs Focused Revision": "text-terracotta border-terracotta/40 bg-terracotta/10",
};

export function EvaluationAnalytics({ data, deviceNote }: {
  data: ChildAnalytics;
  /** "parent" → worded for the parent portal ("your child's device");
   *  "student-device" → worded for Parent's Corner ("this device"). */
  deviceNote: "parent" | "student-device";
}) {
  return (
    <div>
      <div className="mb-6">
        <div className="mb-3 font-display text-base text-chalk">Chapter-end test reports</div>
        <p className="mb-3 text-xs text-chalkdim">The classroom gives these tests automatically when a textbook chapter ends.</p>
        {data.chapterTests?.length ? <div className="space-y-2">{data.chapterTests.map((test, index) => <Card key={`${test.attemptedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-chalk">{test.chapterTitle}</p><p className="text-[10px] text-chalkdim">{test.subject} · {test.textbookTitle} · {new Date(test.attemptedAt).toLocaleDateString("en-IN")}</p></div><div className="text-right"><p className={`font-mono text-lg ${test.passed ? "text-marigold" : "text-terracotta"}`}>{test.percentage}%</p><p className="text-[10px] text-chalkdim">{test.score}/{test.total} · {test.passed ? "Ready" : "Needs revision"}</p></div></Card>)}</div>:<Card><p className="text-sm text-chalkdim">No chapter test completed yet.</p></Card>}
      </div>
      {/* Mastery Score + Exam Readiness — the headline numbers, per subject */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
          <Gauge size={16} className="text-marigold" /> Mastery score &amp; exam readiness
        </div>
        <p className="mb-3 text-xs text-chalkdim">
          Mastery score = 50% chapters completed + 50% how well they're doing on quizzes, per
          subject — recent quiz attempts count more than old ones, so a topic they've since
          improved at isn't held back by early mistakes. Readiness is a simple guide from that
          score, not a scientific prediction.
        </p>
        {data.masteryBySubject.length === 0 ? (
          <Card><p className="text-sm text-chalkdim">No Study Materials activity yet.</p></Card>
        ) : (
          <>
          {/* The graphs first — the gap between the three bars per subject
              is the parent's real signal (covered a lot but low accuracy =
              rushing; the reverse = careful but behind schedule). */}
          <Card className="mb-3">
            <SubjectMasteryChart data={data} />
          </Card>
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_1.2fr]">
            <Card>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Exam readiness at a glance</div>
              <ReadinessDonut data={data} />
            </Card>
            <Card className="flex flex-col justify-center">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">How to read the chart</div>
              <p className="text-xs text-chalkdim leading-relaxed">
                Amber = overall mastery. Blue = how much of the syllabus is covered. Green = how
                accurately quizzes are answered. When blue is far ahead of green, your child is
                moving fast but not retaining — slow down and revise. When green leads blue,
                they're learning well but need to cover more chapters.
              </p>
            </Card>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.masteryBySubject.map(m => {
              const readiness = data.readinessBySubject.find(r => r.subject === m.subject);
              return (
                <Card key={m.subject} className="py-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-chalk">{m.subject}</span>
                    <span className="font-mono text-lg text-marigold">{m.masteryScore}</span>
                  </div>
                  <div className="mb-2 h-1.5 w-full rounded-full bg-board3 overflow-hidden">
                    <div className="h-full bg-marigold" style={{ width: `${m.masteryScore}%` }} />
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-chalkdim">
                    <span>{m.completionPct}% covered{m.quizAccuracyPct !== null ? ` · ${m.quizAccuracyPct}% quiz accuracy` : ""}</span>
                    {readiness && (
                      <span className={`rounded-full border px-2 py-0.5 ${READINESS_COLOR[readiness.readiness]}`}>
                        {readiness.readiness}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          </>
        )}
      </div>

      {/* Weak Topic Analysis */}
      {data.weakTopics.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
            <TrendingDown size={16} className="text-terracotta" /> Topics needing attention
          </div>
          <div className="flex flex-col gap-2">
            {data.weakTopics.map((t, i) => (
              <Card key={i} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm text-chalk">{t.topic}</div>
                  <div className="font-mono text-[10px] text-chalkdim">{t.subject} · {t.attempts} attempts</div>
                </div>
                <span className="font-mono text-sm text-terracotta">{t.accuracyPct}%</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Personalized Study Plan */}
      {(data.studyPlan.revise.length > 0 || data.studyPlan.continue.length > 0) && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
            <Target size={16} className="text-marigold" /> Recommended next steps
          </div>
          <Card>
            <ul className="flex flex-col gap-1.5 text-sm text-chalkdim">
              {data.studyPlan.revise.map((s, i) => <li key={`r${i}`}>🔁 {s}</li>)}
              {data.studyPlan.continue.map((s, i) => <li key={`c${i}`}>➡️ {s}</li>)}
            </ul>
          </Card>
        </div>
      )}

      {/* Revision Schedule */}
      {data.dueForRevision.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
            <CalendarClock size={16} className="text-blue" /> Due for revision
          </div>
          <Card>
            <ul className="flex flex-col gap-1.5 text-sm text-chalkdim">
              {data.dueForRevision.slice(0, 6).map((t, i) => (
                <li key={i}>{t.topic} — last practiced {t.daysSinceLastActivity} days ago</li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Bloom's Taxonomy + Competency Mapping */}
      {data.bloomsMapping.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
            <Layers size={16} className="text-marigold" /> Bloom's Taxonomy breakdown
          </div>
          <Card>
            {/* Falling bars toward the right = recalls facts but can't yet
                apply them — the exact thing competency-based exams test. */}
            <BloomsChart data={data} />
            <div className="mt-3 flex flex-col gap-2 border-t border-board3 pt-3">
              {data.bloomsMapping.map(b => (
                <div key={b.level} className="flex items-center justify-between">
                  <span className="text-sm text-chalk">{BLOOMS_LABELS[b.level] || b.level}</span>
                  <span className="font-mono text-[11px] text-chalkdim">
                    {b.attempts} attempts{b.accuracyPct !== null ? ` · ${b.accuracyPct}% correct` : ""}
                  </span>
                </div>
              ))}
            </div>
            {data.competencyMapping.attempts > 0 && (
              <div className="mt-3 border-t border-board3 pt-3 text-xs text-chalkdim">
                <b className="text-chalk">Competency-based questions</b> (Apply/Analyze/Evaluate/Create): {data.competencyMapping.attempts} attempts, {data.competencyMapping.accuracyPct}% correct.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Learning Objectives — what's actually been covered */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
          <BookOpen size={16} className="text-marigold" /> What they've learned
        </div>
        {data.learningObjectives.length === 0 ? (
          <Card><p className="text-sm text-chalkdim">Nothing completed yet.</p></Card>
        ) : (
          <Card>
            <ul className="flex flex-col gap-1.5 text-sm text-chalkdim max-h-64 overflow-y-auto">
              {data.learningObjectives.map((o, i) => (
                <li key={i}>✓ {o.objective} <span className="font-mono text-[10px] text-chalkdim opacity-60">({o.subject})</span></li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="rounded-lg border border-board3 bg-board2 px-3.5 py-3 text-xs text-chalkdim">
        {deviceNote === "parent"
          ? "This reflects Study Materials activity only — quick one-off lessons from Classroom's topic picker or Teach-from-textbook are saved on your child's own device and aren't visible here."
          : "This reflects Study Materials activity only — quick one-off lessons from the Classroom's topic picker are saved on this device and aren't part of these numbers."}
      </div>
    </div>
  );
}
