"use client";
import { PremiumGate } from "@/components/SubscriptionGate";
/**
 * Exam Room — a full, timed exam paper following a REAL, verified board
 * pattern (lib/exam-patterns.ts), not a loose practice set. Genuinely
 * different from Practice Materials: real mark weightage across
 * sections, a countdown timer, submit-once-see-score-after — the shape
 * of an actual exam, not a casual quiz.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clock, FileText, ChevronRight, Upload, AlertTriangle } from "lucide-react";
import { Card, PageHeader, Button } from "@/components/ui";
import { studentSession } from "@/lib/student-session";
import type { ExamAttempt } from "@/lib/exam-schema";
import type { ExtractedPatternDraft } from "@/lib/exam-patterns";

function ExamRoomPage() {
  const profile = studentSession.get();
  const router = useRouter();

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [pastAttempts, setPastAttempts] = useState<ExamAttempt[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // ── Upload your own paper — for any class, subject, or board not in
  // our pre-verified library. See lib/exam-patterns.ts's
  // extractPatternFromPdf for the extraction logic (shared with the
  // admin curation tool). This is a one-off personal paper — never
  // published or shared, so the student confirms it themselves in
  // plain language, not by reviewing raw JSON the way an admin would. ──
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSubject, setUploadSubject] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [draft, setDraft] = useState<ExtractedPatternDraft | null>(null);
  const [mismatches, setMismatches] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [generatingFromPdf, setGeneratingFromPdf] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetch(`/api/student/exam-room/history?studentId=${encodeURIComponent(profile.email)}`)
      .then(r => r.json())
      .then(d => setPastAttempts(d.attempts || []))
      .finally(() => setLoadingHistory(false));
  }, []);

  async function startExam() {
    if (!profile) return;
    setStarting(true); setError("");
    try {
      const res = await fetch("/api/student/exam-room/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: profile.email, board: profile.syllabus, grade: profile.grade,
          subject: "Mathematics", languageId: profile.languageId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/exam-room/${data.attempt.id}`);
    } catch (e: any) {
      setError(e.message || "Could not start the exam. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  async function extractFromUpload() {
    if (!uploadFile) return;
    setExtracting(true); setUploadError(""); setDraft(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      const res = await fetch("/api/student/exam-room/extract-pdf", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.draft);
      setMismatches(data.mismatches || []);
      if (data.draft.durationMinutes > 0) setDurationMinutes(data.draft.durationMinutes);
      if (!uploadSubject) setUploadSubject(data.draft.subjectGuess || "");
    } catch (e: any) {
      setUploadError(e.message || "Could not read this question paper.");
    } finally {
      setExtracting(false);
    }
  }

  async function startFromUpload() {
    if (!profile || !draft) return;
    setGeneratingFromPdf(true); setUploadError("");
    try {
      const res = await fetch("/api/student/exam-room/start-from-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: profile.email, grade: profile.grade, subject: uploadSubject || "General",
          languageId: profile.languageId, board: profile.syllabus,
          draft: { ...draft, durationMinutes },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/exam-room/${data.attempt.id}`);
    } catch (e: any) {
      setUploadError(e.message || "Could not generate the exam. Please try again.");
    } finally {
      setGeneratingFromPdf(false);
    }
  }

  // ── Every question paper already available for this student's exact
  // class and board — loaded automatically on page load, not something
  // the student has to guess a subject name to discover. This is what
  // actually makes a previously-uploaded paper "available to" a
  // matching student, rather than only reachable if they happen to
  // type the right word. ──
  const [sharedMatches, setSharedMatches] = useState<any[]>([]);
  const [loadingShared, setLoadingShared] = useState(true);
  const [startingSharedId, setStartingSharedId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    fetch(`/api/student/exam-room/shared-patterns?board=${encodeURIComponent(profile.syllabus)}&grade=${encodeURIComponent(profile.grade)}`)
      .then(r => r.json())
      .then(d => setSharedMatches(d.patterns || []))
      .finally(() => setLoadingShared(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startFromShared(sharedPatternId: string) {
    if (!profile) return;
    setStartingSharedId(sharedPatternId); setError("");
    try {
      const res = await fetch("/api/student/exam-room/start-from-shared", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: profile.email, languageId: profile.languageId, sharedPatternId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/exam-room/${data.attempt.id}`);
    } catch (e: any) {
      setError(e.message || "Could not start this exam.");
    } finally {
      setStartingSharedId(null);
    }
  }

  const totalQuestions = draft?.sections.reduce((sum, s) => sum + s.blocks.reduce((bs, b) => bs + b.count, 0), 0) || 0;

  if (!profile) return null;

  return (
    <div>
      <PageHeader eyebrow="Exam Room" title="Full exam simulation"
        subtitle="A real, timed board exam paper — genuine mark weightage across sections, not a loose practice set. Submit once, see your score after, exactly like the real thing." />

      <Card className="mb-6">
        <div className="mb-1 font-display text-lg text-chalk">Class {profile.grade} Mathematics</div>
        <div className="mb-4 font-mono text-[10px] uppercase tracking-wider text-marigold">
          {profile.syllabus.toUpperCase()} board pattern
        </div>
        <div className="mb-4 flex gap-4 text-xs text-chalkdim">
          <span className="flex items-center gap-1.5"><FileText size={13} /> 80 marks · 38 questions</span>
          <span className="flex items-center gap-1.5"><Clock size={13} /> 3 hours</span>
        </div>
        <p className="mb-4 text-xs text-chalkdim leading-relaxed">
          5 sections, exactly matching the real CBSE Class 10 Mathematics board exam structure — MCQs and
          Assertion-Reason (auto-checked instantly), Short and Long Answer, and Case Study questions
          (self-checked against a model answer, since free-text can't be machine-graded reliably).
        </p>
        <Button disabled={starting} onClick={startExam}>
          {starting ? <><Loader2 size={14} className="animate-spin" /> Preparing your paper…</> : "Start Exam"}
        </Button>
        {error && <div className="mt-3 text-sm text-terracotta">{error}</div>}
      </Card>

      <Card className="mb-6">
        <div className="mb-1 font-display text-lg text-chalk">Available for Class {profile.grade} · {profile.syllabus.toUpperCase()}</div>
        <p className="mb-4 text-xs text-chalkdim leading-relaxed">
          Question papers other students in your exact class and board have already uploaded — use one
          directly, no need to upload the same subject again.
        </p>

        {loadingShared && <Loader2 size={16} className="animate-spin text-chalkdim" />}

        {!loadingShared && sharedMatches.length === 0 && (
          <p className="text-xs text-chalkdim">
            Nothing shared yet for your class — be the first to upload a subject below, and it'll be here
            for the next student automatically.
          </p>
        )}
        {!loadingShared && sharedMatches.length > 0 && (
          <div className="flex flex-col gap-2">
            {sharedMatches.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-board3 bg-board2 p-3">
                <div className="text-xs text-chalkdim">
                  <span className="text-chalk">{p.subject}</span> — {p.totalMarks} marks · {p.durationMinutes} min
                  {p.useCount > 0 && <span> · used by {p.useCount} other student{p.useCount !== 1 ? "s" : ""}</span>}
                </div>
                <button onClick={() => startFromShared(p.id)} disabled={startingSharedId === p.id}
                  className="shrink-0 rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-board disabled:opacity-50">
                  {startingSharedId === p.id ? <Loader2 size={12} className="animate-spin" /> : "Use this"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="mb-1 font-display text-lg text-chalk">Upload a model or previous-year question paper</div>
        <p className="mb-4 text-xs text-chalkdim leading-relaxed">
          Any class, any subject, any board — upload a model or previous-year question paper PDF
          you already have. The AI reads its real structure and builds a fresh, timed exam matching it,
          so you get new questions in the same format, not the same paper repeated.
        </p>

        {!draft ? (
          <>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">
              Question paper (PDF)
            </div>
            <input type="file" accept="application/pdf" onChange={e => setUploadFile(e.target.files?.[0] || null)}
              className="mb-3 w-full text-xs text-chalkdim" />
            <Button disabled={!uploadFile || extracting} onClick={extractFromUpload}>
              {extracting ? <><Loader2 size={14} className="animate-spin" /> Reading your question paper…</> : <><Upload size={14} /> Read this question paper</>}
            </Button>
          </>
        ) : (
          <>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Subject</div>
            <input value={uploadSubject} onChange={e => setUploadSubject(e.target.value)}
              className="mb-4 w-full rounded-lg border border-board3 bg-board px-3 py-2 text-sm text-chalk" />

            <div className="mb-4 rounded-lg border border-board3 bg-board2 p-3.5">
              <div className="mb-2 text-sm text-chalk">Here's what we found in your PDF:</div>
              <ul className="mb-3 flex flex-col gap-1 text-xs text-chalkdim">
                {draft.sections.map((s, i) => (
                  <li key={i}>
                    <b className="text-chalk">{s.label}</b> — {s.blocks.map(b => `${b.count} ${b.format} (${b.marksEach} mark${b.marksEach !== 1 ? "s" : ""} each)`).join(", ")}
                    {s.note && <span className="italic"> — {s.note}</span>}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-4 text-xs text-chalkdim">
                <span className="flex items-center gap-1.5"><FileText size={12} /> {draft.totalMarks} marks · {totalQuestions} questions</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={12} /> Duration:
                  <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}
                    className="w-14 rounded border border-board3 bg-board px-1.5 py-0.5 text-chalk" /> min
                </span>
              </div>
            </div>

            {mismatches.length > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-terracotta/30 bg-terracotta/5 p-3 text-xs text-terracotta">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <div>The marks don't quite add up in what we read — double check against your question paper before starting.<br />
                  {mismatches.join(" ")}</div>
              </div>
            )}

            <div className="flex gap-2">
              <Button disabled={generatingFromPdf} onClick={startFromUpload}>
                {generatingFromPdf ? <><Loader2 size={14} className="animate-spin" /> Preparing your exam…</> : "Looks right — start exam"}
              </Button>
              <button onClick={() => { setDraft(null); setUploadFile(null); }}
                className="rounded-lg border border-board3 px-4 py-2 text-sm text-chalkdim hover:text-chalk">
                Try a different question paper
              </button>
            </div>
          </>
        )}
        {uploadError && <div className="mt-3 text-sm text-terracotta">{uploadError}</div>}
      </Card>

      {!loadingHistory && pastAttempts.length > 0 && (
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Past attempts</div>
          <div className="flex flex-col gap-2">
            {pastAttempts.map(a => (
              <button key={a.id} onClick={() => router.push(`/exam-room/${a.id}`)}
                className="flex items-center justify-between rounded-xl border border-board3 bg-board2 p-3.5 text-left hover:border-marigold/40 transition-colors">
                <div>
                  <div className="text-sm text-chalk">{a.subject} — Class {a.grade}</div>
                  <div className="font-mono text-[10px] text-chalkdim">
                    {new Date(a.startedAt).toLocaleDateString()}
                    {a.submittedAt ? ` · ${a.autoScore}/${a.autoScoreMax} auto-checked` : " · in progress"}
                  </div>
                </div>
                <ChevronRight size={16} className="text-chalkdim shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Premium gate (dunning flow) — while a subscription is DEGRADED this
 * page shows the renew card instead; full/grace render normally. Has no
 * effect while ENFORCE_SUBSCRIPTIONS is false (lib/dev-mode.ts).
 */
export default function GatedExamRoomPage() {
  return <PremiumGate feature="Exam Room"><ExamRoomPage /></PremiumGate>;
}
