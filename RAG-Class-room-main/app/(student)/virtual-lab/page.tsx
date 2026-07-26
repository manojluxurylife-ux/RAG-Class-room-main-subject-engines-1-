"use client";
/**
 * Virtual Lab — a grounded narration, not a manipulable simulation. See
 * lib/lab-kb.ts for the full reasoning: real curated NCERT experiment
 * data grounds the AI's walkthrough when a match is found; genuinely
 * flagged as ungrounded general knowledge when it isn't, rather than
 * presenting both with the same confidence.
 */
import { useState } from "react";
import { Loader2, FlaskConical, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, PageHeader, Button } from "@/components/ui";
import { studentSession } from "@/lib/student-session";

const SUBJECTS = ["Physics", "Chemistry", "Biology"];

interface LabNarration {
  experimentName: string;
  objective: string;
  apparatus: string[];
  procedure: string[];
  observation: string;
  reason: string;
  safetyNotes?: string;
  commonMistakes: string[];
}

export default function VirtualLabPage() {
  const profile = studentSession.get();

  const [experimentQuery, setExperimentQuery] = useState("");
  const [subject, setSubject] = useState("Chemistry");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [narration, setNarration] = useState<LabNarration | null>(null);
  const [grounded, setGrounded] = useState(false);

  async function generate() {
    if (!experimentQuery.trim() || !profile) return;
    setGenerating(true); setError(""); setNarration(null);
    try {
      const res = await fetch("/api/student/virtual-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentQuery: experimentQuery.trim(), subject,
          grade: profile.grade, boardId: profile.syllabus, languageId: profile.languageId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNarration(data.narration);
      setGrounded(data.grounded);
    } catch (e: any) {
      setError(e.message || "Could not generate this narration.");
    } finally {
      setGenerating(false);
    }
  }

  if (!profile) return null;

  return (
    <div>
      <PageHeader eyebrow="Virtual Lab" title="Experiment walkthroughs"
        subtitle="A vivid, accurate walkthrough of a real experiment — apparatus, procedure, what happens, and why. Not a simulation you manipulate, a guided narration you can read anywhere, no lab required." />

      {!narration && (
        <Card className="mb-6">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Subject</div>
          <div className="mb-4 flex gap-2">
            {SUBJECTS.map(s => (
              <button key={s} onClick={() => setSubject(s)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  subject === s ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                }`}>
                {s}
              </button>
            ))}
          </div>

          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Experiment</div>
          <input className="mb-4 w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
            placeholder="e.g. Burning of magnesium ribbon, Verifying Ohm's Law, Testing a leaf for starch…"
            value={experimentQuery} onChange={e => setExperimentQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && generate()} />

          <Button disabled={!experimentQuery.trim() || generating} onClick={generate}>
            {generating ? <><Loader2 size={14} className="animate-spin" /> Preparing walkthrough…</> : <><Sparkles size={14} /> Show me this experiment</>}
          </Button>
          {error && <div className="mt-3 text-sm text-terracotta">{error}</div>}
        </Card>
      )}

      {narration && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-lg text-chalk">{narration.experimentName}</div>
            <button onClick={() => { setNarration(null); setExperimentQuery(""); }}
              className="rounded-lg border border-board3 px-3 py-1.5 text-xs text-chalkdim hover:text-chalk">
              Try another
            </button>
          </div>

          <div className={`mb-4 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs ${
            grounded ? "border-marigold/40 bg-marigold/10 text-chalk" : "border-blue/40 bg-blue/10 text-chalk"
          }`}>
            {grounded
              ? <><CheckCircle2 size={14} className="text-marigold shrink-0" /> Verified against curated experiment data — apparatus and results are confirmed accurate.</>
              : <><AlertTriangle size={14} className="text-blue shrink-0" /> This experiment isn't in our verified set yet — this is AI Guru's general knowledge, not independently confirmed.</>}
          </div>

          <Card className="mb-4">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-marigold">Objective</div>
            <p className="mb-4 text-sm text-chalk">{narration.objective}</p>

            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-marigold">Apparatus</div>
            <ul className="mb-4 flex flex-wrap gap-1.5">
              {narration.apparatus.map((a, i) => (
                <li key={i} className="rounded-full border border-board3 bg-board2 px-2.5 py-1 text-xs text-chalkdim">{a}</li>
              ))}
            </ul>

            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-marigold">Procedure</div>
            <ol className="mb-4 list-decimal pl-5 text-sm text-chalk space-y-1">
              {narration.procedure.map((s, i) => <li key={i}>{s}</li>)}
            </ol>

            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-terracotta">What you'd actually see</div>
            <p className="mb-4 text-sm text-chalk">{narration.observation}</p>

            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-terracotta">Why it happens</div>
            <p className="text-sm text-chalk">{narration.reason}</p>
          </Card>

          {narration.safetyNotes && (
            <Card className="mb-4 flex items-start gap-2.5">
              <ShieldAlert size={15} className="text-terracotta shrink-0 mt-0.5" />
              <div>
                <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-terracotta">Safety</div>
                <p className="text-sm text-chalkdim">{narration.safetyNotes}</p>
              </div>
            </Card>
          )}

          {narration.commonMistakes.length > 0 && (
            <Card className="flex items-start gap-2.5">
              <FlaskConical size={15} className="text-marigold shrink-0 mt-0.5" />
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-marigold">Common mistakes to avoid</div>
                <ul className="flex flex-col gap-1 text-sm text-chalkdim">
                  {narration.commonMistakes.map((m, i) => <li key={i}>• {m}</li>)}
                </ul>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
