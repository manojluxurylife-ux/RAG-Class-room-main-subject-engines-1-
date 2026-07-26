"use client";
/**
 * The actual timed exam-taking experience, and the results/review
 * screen after submission. No per-question feedback while taking the
 * exam — that's the whole point of Exam Room vs. Practice Materials;
 * feedback only appears after a real, final submit.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Clock, Check, X as XIcon, ChevronDown, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui";
import type { ExamAttempt, ExamQuestion } from "@/lib/exam-schema";
import { AUTO_CHECKABLE } from "@/lib/practice-schema";

export default function ExamAttemptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  useEffect(() => {
    fetch(`/api/student/exam-room/${id}`)
      .then(r => r.json())
      .then(d => {
        setAttempt(d.attempt);
        setAnswers(d.attempt?.answers || {});
        setWrittenAnswers(d.attempt?.writtenAnswers || {});
        if (d.attempt && !d.attempt.submittedAt) {
          const elapsedMs = Date.now() - new Date(d.attempt.startedAt).getTime();
          const totalMs = d.attempt.durationMinutes * 60 * 1000;
          setSecondsLeft(Math.max(0, Math.round((totalMs - elapsedMs) / 1000)));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const submitExam = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/exam-room/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, writtenAnswers, selfMarks: {} }),
      });
      const data = await res.json();
      if (res.ok) setAttempt(data.attempt);
    } finally {
      setSubmitting(false);
      setConfirmingSubmit(false);
    }
  }, [id, answers, writtenAnswers]);

  // Countdown — auto-submits the moment time runs out, no grace period,
  // matching a real invigilated exam.
  useEffect(() => {
    if (secondsLeft === null || attempt?.submittedAt) return;
    if (secondsLeft <= 0) { submitExam(); return; }
    const t = setTimeout(() => setSecondsLeft(s => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, attempt?.submittedAt, submitExam]);

  async function selfMark(questionId: string, mark: "correct" | "partial" | "incorrect") {
    const res = await fetch(`/api/student/exam-room/${id}/self-mark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, mark }),
    });
    const data = await res.json();
    if (res.ok) setAttempt(data.attempt);
  }

  if (loading) return <div className="flex items-center gap-2 py-16 text-chalkdim"><Loader2 size={18} className="animate-spin" /> Loading…</div>;
  if (!attempt) return <div className="py-16 text-center text-chalkdim">Exam attempt not found.</div>;

  const minutes = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const seconds = secondsLeft !== null ? secondsLeft % 60 : 0;
  const isLowTime = secondsLeft !== null && secondsLeft < 300;

  // ── Results / review mode ──
  if (attempt.submittedAt) {
    return (
      <div>
        <Card className="mb-6 text-center">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Exam submitted</div>
          <div className="mb-2 font-display text-3xl text-marigold">{attempt.autoScore} / {attempt.autoScoreMax}</div>
          <div className="text-xs text-chalkdim">Auto-checked (MCQ + Assertion-Reason) — objective, machine-graded.</div>
          <div className="mt-3 border-t border-board3 pt-3 text-sm text-chalk">
            ~{attempt.estimatedScore} / {attempt.totalMarks} <span className="text-chalkdim">estimated total</span>
          </div>
          <div className="text-[11px] text-chalkdim">Includes your self-assessment below — not machine-graded, an estimate only.</div>
        </Card>

        {attempt.sections.map(section => (
          <div key={section.label} className="mb-5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-marigold">{section.label}</div>
            <div className="flex flex-col gap-3">
              {section.questions.map((q, i) => (
                <ResultCard key={q.id} q={q} index={i + 1}
                  studentAnswer={attempt.answers[q.id]}
                  writtenAnswer={attempt.writtenAnswers[q.id]}
                  selfMark={attempt.selfMarks[q.id]}
                  onSelfMark={mark => selfMark(q.id, mark)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Timed exam-taking mode ──
  return (
    <div>
      <div className="sticky top-0 z-10 mb-5 flex items-center justify-between rounded-xl border border-board3 bg-board/95 backdrop-blur px-4 py-3 shadow-lg">
        <div>
          <div className="text-sm font-medium text-chalk">{attempt.subject} — Class {attempt.grade}</div>
          <div className="font-mono text-[10px] text-chalkdim">{attempt.totalMarks} marks</div>
        </div>
        <div className={`flex items-center gap-1.5 font-mono text-lg font-bold ${isLowTime ? "text-terracotta" : "text-chalk"}`}>
          <Clock size={16} /> {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
      </div>

      {attempt.sections.map(section => (
        <div key={section.label} className="mb-5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-marigold">{section.label}</div>
          <div className="flex flex-col gap-3">
            {section.questions.map((q, i) => (
              <AnswerCard key={q.id} q={q} index={i + 1}
                answer={answers[q.id]}
                writtenAnswer={writtenAnswers[q.id] || ""}
                onAnswer={v => setAnswers(a => ({ ...a, [q.id]: v }))}
                onWrite={v => setWrittenAnswers(w => ({ ...w, [q.id]: v }))} />
            ))}
          </div>
        </div>
      ))}

      <Card className="mt-2">
        {!confirmingSubmit ? (
          <button onClick={() => setConfirmingSubmit(true)}
            className="w-full rounded-lg bg-marigold px-4 py-3 text-sm font-semibold text-board hover:bg-marigolddim">
            Submit Exam
          </button>
        ) : (
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-terracotta">
              <AlertTriangle size={15} /> This is final — you can't change your answers after submitting. Submit now?
            </div>
            <div className="flex gap-2">
              <button onClick={submitExam} disabled={submitting}
                className="flex-1 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-semibold text-board disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Yes, submit"}
              </button>
              <button onClick={() => setConfirmingSubmit(false)}
                className="flex-1 rounded-lg border border-board3 px-4 py-2.5 text-sm text-chalkdim hover:text-chalk">
                Keep working
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Answer input, exam-taking mode — collects the answer, never shows correct/incorrect ──
function AnswerCard({ q, index, answer, writtenAnswer, onAnswer, onWrite }: {
  q: ExamQuestion; index: number; answer: any; writtenAnswer: string;
  onAnswer: (v: any) => void; onWrite: (v: string) => void;
}) {
  return (
    <Card>
      <div className="mb-2 font-mono text-[10px] text-chalkdim">Q{index} · {q.marks} mark{q.marks !== 1 ? "s" : ""}</div>

      {q.format === "assertion-reason" && (
        <div className="mb-3 text-sm text-chalk">
          <div className="mb-1"><b>Assertion (A):</b> {q.assertion}</div>
          <div><b>Reason (R):</b> {q.reason}</div>
        </div>
      )}
      {(q.format === "mcq" || q.format === "hots" || q.format === "competency-based" || q.format === "assertion-reason") && q.options && (
        <>
          {q.format !== "assertion-reason" && <div className="mb-3 text-sm text-chalk">{q.question}</div>}
          <div className="flex flex-col gap-2">
            {q.options.map((opt, i) => (
              <button key={i} onClick={() => onAnswer(i)}
                className={`text-left rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                  answer === i ? "border-marigold bg-marigold/10 text-chalk" : "border-board3 text-chalkdim hover:border-marigold/40"
                }`}>
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
      {q.format === "true-false" && (
        <>
          <div className="mb-3 text-sm text-chalk">{q.statement}</div>
          <div className="flex gap-2">
            {["True", "False"].map((label, i) => (
              <button key={label} onClick={() => onAnswer(i === 0)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm ${
                  answer === (i === 0) ? "border-marigold bg-marigold/10 text-chalk" : "border-board3 text-chalkdim hover:border-marigold/40"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {q.format === "fill-blank" && (
        <>
          <div className="mb-3 text-sm text-chalk">{q.sentence}</div>
          <input value={answer || ""} onChange={e => onAnswer(e.target.value)}
            className="w-full rounded-lg border border-board3 bg-board px-3.5 py-2 text-sm text-chalk" placeholder="Your answer…" />
        </>
      )}
      {q.format === "match-following" && q.columnA && q.columnB && (
        <div className="flex flex-col gap-2">
          {q.columnA.map((left, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-1/2 text-sm text-chalk">{left}</div>
              <select value={answer?.[i] ?? ""} onChange={e => onAnswer({ ...(answer || {}), [i]: Number(e.target.value) })}
                className="w-1/2 rounded-lg border border-board3 bg-board px-2.5 py-1.5 text-xs text-chalk">
                <option value="">— match —</option>
                {q.columnB!.map((right, j) => <option key={j} value={j}>{right}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      {(q.format === "short-answer" || q.format === "long-answer") && (
        <>
          <div className="mb-3 text-sm text-chalk">{q.prompt}</div>
          <textarea value={writtenAnswer} onChange={e => onWrite(e.target.value)} rows={q.format === "long-answer" ? 5 : 3}
            className="w-full rounded-lg border border-board3 bg-board px-3.5 py-2 text-sm text-chalk" placeholder="Write your answer…" />
        </>
      )}
      {q.format === "case-study" && q.caseScenario && (
        <>
          <div className="mb-3 rounded-lg border border-dashed border-board3 p-3 text-sm text-chalkdim">{q.caseScenario}</div>
          {q.subQuestions?.map((sq, i) => <div key={i} className="mb-1.5 text-sm text-chalk">{i + 1}. {sq.question}</div>)}
          <textarea value={writtenAnswer} onChange={e => onWrite(e.target.value)} rows={5}
            className="w-full rounded-lg border border-board3 bg-board px-3.5 py-2 text-sm text-chalk" placeholder="Write your answers…" />
        </>
      )}
    </Card>
  );
}

// ── Results/review card — shows correctness for auto-checkable, self-assessment for open-ended ──
function ResultCard({ q, index, studentAnswer, writtenAnswer, selfMark, onSelfMark }: {
  q: ExamQuestion; index: number; studentAnswer: any; writtenAnswer?: string;
  selfMark?: "correct" | "partial" | "incorrect"; onSelfMark: (m: "correct" | "partial" | "incorrect") => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const isAuto = AUTO_CHECKABLE.includes(q.format);

  let correct = false;
  if (isAuto) {
    if (q.format === "true-false") correct = studentAnswer === q.answerBool;
    else if (q.format === "fill-blank") correct = (studentAnswer || "").trim().toLowerCase() === (q.blankAnswer || "").trim().toLowerCase();
    else if (q.format === "match-following" && q.correctMapping) correct = q.correctMapping.every((c, i) => studentAnswer?.[i] === c);
    else correct = studentAnswer === q.correctIndex;
  }

  return (
    <Card>
      <div className="mb-2 font-mono text-[10px] text-chalkdim">Q{index} · {q.marks} mark{q.marks !== 1 ? "s" : ""}</div>
      {isAuto ? (
        <>
          <div className="mb-2 text-sm text-chalk">{q.question || q.assertion}</div>
          <div className={`flex items-center gap-1.5 text-xs font-medium ${correct ? "text-marigold" : "text-terracotta"}`}>
            {correct ? <><Check size={13} /> Correct</> : <><XIcon size={13} /> Not quite</>}
          </div>
          {q.explanation && <div className="mt-2 border-t border-board3 pt-2 text-xs text-chalkdim"><b className="text-chalk">Why:</b> {q.explanation}</div>}
        </>
      ) : (
        <>
          <div className="mb-2 text-sm text-chalk">{q.prompt || q.caseScenario}</div>
          {writtenAnswer && <div className="mb-2 rounded-lg border border-board3 bg-board p-2.5 text-xs text-chalkdim"><b className="text-chalk">Your answer:</b> {writtenAnswer}</div>}
          {revealed ? (
            <div className="mb-2 rounded-lg border border-board3 bg-board p-2.5 text-xs text-chalkdim">
              <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-marigold">Model answer</div>
              {q.modelAnswer || q.subQuestions?.map(sq => sq.modelAnswer).join(" ")}
            </div>
          ) : (
            <button onClick={() => setRevealed(true)} className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-board3 px-3 py-1.5 text-xs text-chalkdim hover:text-chalk">
              <ChevronDown size={12} /> Show model answer
            </button>
          )}
          {revealed && (
            <div className="flex gap-2">
              {(["correct", "partial", "incorrect"] as const).map(m => (
                <button key={m} onClick={() => onSelfMark(m)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] capitalize ${
                    selfMark === m ? "border-marigold bg-marigold/10 text-chalk" : "border-board3 text-chalkdim hover:text-chalk"
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
