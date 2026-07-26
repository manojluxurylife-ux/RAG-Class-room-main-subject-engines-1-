"use client";
import { PremiumGate } from "@/components/SubscriptionGate";
/**
 * Practice Materials — genuinely interactive practice questions across
 * real Indian exam formats (Assertion-Reason, Match-the-Following,
 * Fill-in-the-Blanks, True/False, Short/Long Answer, HOTS, Case-Study,
 * Competency-Based), not markdown text with an answer key at the
 * bottom. Checkable question-by-question in the browser.
 *
 * Reuses the exact same per-format pedagogical instructions already
 * written for Creator Studio's quiz generator (lib/content-generators.ts)
 * — only the output shape differs (structured JSON here, so this page
 * can render real interactive checking; markdown there, for a document
 * a teacher publishes). See lib/practice-schema.ts for the full shape.
 */
import { useState } from "react";
import { Loader2, Sparkles, RotateCcw, Check, X as XIcon, ChevronDown } from "lucide-react";
import { Card, PageHeader, Button } from "@/components/ui";
import { studentSession } from "@/lib/student-session";
import { PRACTICE_FORMATS, AUTO_CHECKABLE, type PracticeSet, type PracticeQuestion } from "@/lib/practice-schema";

const DIFFICULTIES = ["easy", "medium", "hard", "mixed"];
const EXAM_STYLES = [
  { id: "standard", label: "Standard" },
  { id: "previous-year", label: "Previous-Year Style" },
  { id: "ncert-exemplar", label: "NCERT Exemplar Style" },
];

function PracticePage() {
  const profile = studentSession.get();

  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("mcq");
  const [difficulty, setDifficulty] = useState("medium");
  const [examStyle, setExamStyle] = useState("standard");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [set, setSet] = useState<PracticeSet | null>(null);

  async function generate() {
    if (!topic.trim() || !profile) return;
    setGenerating(true); setError(""); setSet(null);
    try {
      const res = await fetch("/api/student/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(), subject: "Mathematics", grade: profile.grade,
          boardId: profile.syllabus, languageId: profile.languageId,
          quizFormat: format, quizDifficulty: difficulty, examStyle, count: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSet(data.practiceSet);
    } catch (e: any) {
      setError(e.message || "Could not generate practice questions.");
    } finally {
      setGenerating(false);
    }
  }

  if (!profile) return null;

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Practice Materials"
        subtitle="Real exam formats — Assertion-Reason, HOTS, Case Study, and more — checked instantly, not just an answer key at the end." />

      {!set && (
        <Card className="mb-6">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Topic</div>
          <input className="mb-4 w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
            placeholder="e.g. Quadratic Equations, Chemical Reactions…"
            value={topic} onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && generate()} />

          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Format</div>
              <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                value={format} onChange={e => setFormat(e.target.value)}>
                {PRACTICE_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Difficulty</div>
              <select className="w-full rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk"
                value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
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

          <Button disabled={!topic.trim() || generating} onClick={generate}>
            {generating ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Sparkles size={14} /> Generate practice questions</>}
          </Button>
          {error && <div className="mt-3 text-sm text-terracotta">{error}</div>}
        </Card>
      )}

      {set && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-display text-lg text-chalk">{set.title}</div>
              <div className="font-mono text-[10px] text-chalkdim">{set.questions.length} questions</div>
            </div>
            <button onClick={() => { setSet(null); setTopic(""); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-board3 px-3 py-1.5 text-xs text-chalkdim hover:text-chalk">
              <RotateCcw size={12} /> New set
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {set.questions.map((q, i) => <QuestionCard key={q.id} q={q} index={i + 1} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── One card per question, rendering behavior driven by q.format ──────────
function QuestionCard({ q, index }: { q: PracticeQuestion; index: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [blankInput, setBlankInput] = useState("");
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState(false);

  // Button index 0 = "True", index 1 = "False" — must match the exact
  // same formula used for button highlighting below. A now-fixed bug:
  // this previously checked `selected === 1`, which is backwards (it
  // treated "picked the False button" as the proxy for the student's
  // answer being true), producing exactly inverted correct/incorrect
  // results — caught by testing real True/False scenarios directly,
  // not from inspection alone.
  const isCorrect =
    (q.format === "true-false" && selected !== null) ? (selected === 0) === q.answerBool :
    selected !== null && q.correctIndex !== undefined ? selected === q.correctIndex :
    null;

  return (
    <Card>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-marigold">
        Q{index} · {PRACTICE_FORMATS.find(f => f.id === q.format)?.label || q.format}
      </div>

      {/* ── Assertion-Reason ── */}
      {q.format === "assertion-reason" && (
        <div className="mb-3 text-sm text-chalk">
          <div className="mb-1"><b>Assertion (A):</b> {q.assertion}</div>
          <div><b>Reason (R):</b> {q.reason}</div>
        </div>
      )}

      {/* ── MCQ / HOTS / Competency / Assertion-Reason options ── */}
      {(q.format === "mcq" || q.format === "hots" || q.format === "competency-based" || q.format === "assertion-reason") && q.options && (
        <>
          {q.format !== "assertion-reason" && <div className="mb-3 text-sm text-chalk">{q.question}</div>}
          <div className="flex flex-col gap-2 mb-3">
            {q.options.map((opt, i) => (
              <button key={i} disabled={checked}
                onClick={() => { setSelected(i); setChecked(true); }}
                className={`text-left rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                  checked && i === q.correctIndex ? "border-marigold bg-marigold/10 text-chalk"
                  : checked && i === selected ? "border-terracotta bg-terracotta/10 text-chalk"
                  : "border-board3 text-chalkdim hover:border-marigold/40"
                }`}>
                {opt}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── True/False ── */}
      {q.format === "true-false" && (
        <>
          <div className="mb-3 text-sm text-chalk">{q.statement}</div>
          <div className="flex gap-2 mb-3">
            {["True", "False"].map((label, i) => (
              <button key={label} disabled={checked}
                onClick={() => { setSelected(i); setChecked(true); }}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  checked && (i === 0) === q.answerBool ? "border-marigold bg-marigold/10 text-chalk"
                  : checked && i === selected ? "border-terracotta bg-terracotta/10 text-chalk"
                  : "border-board3 text-chalkdim hover:border-marigold/40"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Fill in the Blank ── */}
      {q.format === "fill-blank" && (
        <>
          <div className="mb-3 text-sm text-chalk">{q.sentence}</div>
          <div className="flex gap-2 mb-3">
            <input value={blankInput} onChange={e => setBlankInput(e.target.value)} disabled={checked}
              className="flex-1 rounded-lg border border-board3 bg-board px-3.5 py-2 text-sm text-chalk disabled:opacity-70"
              placeholder="Your answer…" onKeyDown={e => e.key === "Enter" && setChecked(true)} />
            {!checked && (
              <button onClick={() => setChecked(true)} disabled={!blankInput.trim()}
                className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-board disabled:opacity-50">
                Check
              </button>
            )}
          </div>
          {checked && (
            <div className={`mb-3 text-xs ${blankInput.trim().toLowerCase() === q.blankAnswer?.toLowerCase().trim() ? "text-marigold" : "text-terracotta"}`}>
              {blankInput.trim().toLowerCase() === q.blankAnswer?.toLowerCase().trim() ? "✓ Correct" : `✗ Correct answer: ${q.blankAnswer}`}
            </div>
          )}
        </>
      )}

      {/* ── Match the Following ── */}
      {q.format === "match-following" && q.columnA && q.columnB && (
        <>
          <div className="mb-3 flex flex-col gap-2">
            {q.columnA.map((left, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1/2 text-sm text-chalk">{left}</div>
                <select disabled={checked} value={matches[i] ?? ""} onChange={e => setMatches(m => ({ ...m, [i]: Number(e.target.value) }))}
                  className="w-1/2 rounded-lg border border-board3 bg-board px-2.5 py-1.5 text-xs text-chalk disabled:opacity-70">
                  <option value="">— match —</option>
                  {q.columnB!.map((right, j) => <option key={j} value={j}>{right}</option>)}
                </select>
                {checked && (
                  matches[i] === q.correctMapping?.[i]
                    ? <Check size={14} className="text-marigold shrink-0" />
                    : <XIcon size={14} className="text-terracotta shrink-0" />
                )}
              </div>
            ))}
          </div>
          {!checked && (
            <button onClick={() => setChecked(true)} disabled={Object.keys(matches).length < q.columnA.length}
              className="mb-3 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-board disabled:opacity-50">
              Check matches
            </button>
          )}
        </>
      )}

      {/* ── Short/Long Answer — self-check only ── */}
      {(q.format === "short-answer" || q.format === "long-answer") && (
        <>
          <div className="mb-3 text-sm text-chalk">{q.prompt}</div>
          {revealed ? (
            <div className="mb-1 rounded-lg border border-board3 bg-board p-3 text-sm text-chalkdim">
              <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-marigold">Model answer</div>
              {q.modelAnswer}
            </div>
          ) : (
            <button onClick={() => setRevealed(true)}
              className="mb-1 inline-flex items-center gap-1.5 rounded-lg border border-board3 px-3.5 py-2 text-xs text-chalkdim hover:text-chalk">
              <ChevronDown size={12} /> Show model answer
            </button>
          )}
        </>
      )}

      {/* ── Case Study ── */}
      {q.format === "case-study" && q.caseScenario && (
        <>
          <div className="mb-3 rounded-lg border border-dashed border-board3 p-3 text-sm text-chalkdim">{q.caseScenario}</div>
          <div className="flex flex-col gap-3">
            {q.subQuestions?.map((sq, i) => (
              <div key={i}>
                <div className="mb-1.5 text-sm text-chalk">{i + 1}. {sq.question}</div>
                <CaseSubAnswer modelAnswer={sq.modelAnswer} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Correct/incorrect result, once checked, for auto-checkable formats */}
      {checked && isCorrect !== null && AUTO_CHECKABLE.includes(q.format) && q.format !== "fill-blank" && q.format !== "match-following" && (
        <div className={`mb-1 flex items-center gap-1.5 text-xs font-medium ${isCorrect ? "text-marigold" : "text-terracotta"}`}>
          {isCorrect ? <><Check size={13} /> Correct</> : <><XIcon size={13} /> Not quite</>}
        </div>
      )}

      {/* Explanation, shown once checked, for auto-checkable formats */}
      {checked && q.explanation && AUTO_CHECKABLE.includes(q.format) && (
        <div className="mt-2 border-t border-board3 pt-2.5 text-xs text-chalkdim">
          <b className="text-chalk">Why:</b> {q.explanation}
        </div>
      )}
    </Card>
  );
}

function CaseSubAnswer({ modelAnswer }: { modelAnswer: string }) {
  const [revealed, setRevealed] = useState(false);
  if (revealed) {
    return <div className="rounded-lg border border-board3 bg-board p-2.5 text-xs text-chalkdim">{modelAnswer}</div>;
  }
  return (
    <button onClick={() => setRevealed(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-board3 px-3 py-1.5 text-[11px] text-chalkdim hover:text-chalk">
      <ChevronDown size={11} /> Show answer
    </button>
  );
}

/**
 * Premium gate (dunning flow) — while a subscription is DEGRADED this
 * page shows the renew card instead; full/grace render normally. Has no
 * effect while ENFORCE_SUBSCRIPTIONS is false (lib/dev-mode.ts).
 */
export default function GatedPracticePage() {
  return <PremiumGate feature="Practice"><PracticePage /></PremiumGate>;
}
