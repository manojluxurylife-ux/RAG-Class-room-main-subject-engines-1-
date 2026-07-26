"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { CheckCircle, RefreshCw, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import type { StudyMaterial } from "@/lib/study-material-schema";

function statusLabel(status?: string) {
  return ({ passed:"Auto-approved", needs_review:"Needs review", failed:"Failed", approved:"Admin approved", rejected:"Rejected", pending:"Pending" } as Record<string,string>)[status || "pending"] || status;
}

export default function MaterialQaPage() {
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/material-qa", { cache: "no-store" });
      const data = await res.json();
      setMaterials(data.materials || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    total: materials.length,
    passed: materials.filter(m => ["passed","approved"].includes(m.qaReport?.status || "")).length,
    review: materials.filter(m => m.qaReport?.status === "needs_review").length,
    failed: materials.filter(m => ["failed","rejected"].includes(m.qaReport?.status || "")).length,
  }), [materials]);

  const visible = materials.filter(m => filter === "all" || (filter === "passed" ? ["passed","approved"].includes(m.qaReport?.status || "") : filter === "failed" ? ["failed","rejected"].includes(m.qaReport?.status || "") : m.qaReport?.status === filter));

  async function act(id: string, action: "rerun"|"approve"|"reject") {
    setBusy(`${id}:${action}`);
    try {
      const reason = action === "reject" ? window.prompt("Reason for rejection:", "Content needs correction before publication") || "Rejected during admin review" : undefined;
      const res = await fetch(`/api/admin/material-qa/${id}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action, reason }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setMaterials(items => items.map(m => m.id === id ? data.material : m));
    } catch (e:any) { window.alert(e.message); }
    finally { setBusy(""); }
  }

  return <div>
    <PageHeader eyebrow="Quality assurance" title="Study Material QA" subtitle="Every completed textbook-generated course is checked before it can enter the shared student library." />
    <div className="grid gap-4 sm:grid-cols-4">
      <StatCard label="Checked" value={String(counts.total)} />
      <StatCard label="Approved" value={String(counts.passed)} />
      <StatCard label="Needs review" value={String(counts.review)} />
      <StatCard label="Failed / rejected" value={String(counts.failed)} />
    </div>

    <div className="my-6 flex flex-wrap gap-2">
      {[['all','All'],['passed','Approved'],['needs_review','Needs review'],['failed','Failed']].map(([id,label]) =>
        <button key={id} onClick={() => setFilter(id)} className={`rounded-lg border px-3 py-2 text-sm ${filter === id ? "border-marigold bg-marigold text-board" : "border-board3 text-chalkdim"}`}>{label}</button>
      )}
    </div>

    {loading ? <Card>Loading QA reports…</Card> : visible.length === 0 ? <EmptyState text="No completed study materials match this filter." /> :
      <div className="space-y-5">{visible.map(material => {
        const q = material.qaReport;
        const status = q?.status || "pending";
        return <Card key={material.id}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {['passed','approved'].includes(status) ? <CheckCircle size={20} className="text-green-400" /> : status === 'needs_review' ? <TriangleAlert size={20} className="text-marigold" /> : <XCircle size={20} className="text-red-400" />}
                <h2 className="font-display text-xl text-chalk">{material.title}</h2>
                <span className="rounded-full border border-board3 px-2 py-1 text-xs text-chalkdim">{statusLabel(status)}</span>
              </div>
              <p className="mt-1 text-xs text-chalkdim">{material.subject} · Class {material.className} · {material.syllabus.toUpperCase()} · {material.targetLanguage}</p>

              {q ? <>
                <div className="mt-4 flex items-end gap-3"><span className="font-display text-4xl text-chalk">{q.overallScore}%</span><span className="pb-1 text-xs text-chalkdim">pass mark {q.passThreshold}%</span></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{q.metrics.map(metric =>
                  <div key={metric.key} className="rounded-xl border border-board3 p-3">
                    <div className="flex justify-between text-xs"><span className="text-chalkdim">{metric.label}</span><strong className="text-chalk">{metric.score}%</strong></div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-board3"><div className="h-full bg-marigold" style={{width:`${metric.score}%`}} /></div>
                    <p className="mt-2 text-[11px] text-chalkdim">{metric.details}</p>
                  </div>)}</div>
                {q.findings.length > 0 && <div className="mt-4 rounded-xl border border-board3 p-4">
                  <h3 className="text-sm font-semibold text-chalk">Findings</h3>
                  <ul className="mt-2 space-y-1 text-xs text-chalkdim">{q.findings.slice(0,8).map((f,i) => <li key={`${f.code}-${i}`}>• [{f.severity}] {f.message}</li>)}</ul>
                </div>}
              </> : <p className="mt-4 text-sm text-chalkdim">No QA report yet. Run the checker.</p>}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 lg:w-40 lg:flex-col">
              <Button variant="ghost" disabled={!!busy} onClick={() => act(material.id,'rerun')}><RefreshCw size={14} /> Re-run QA</Button>
              {!material.publishedMaterialId && <Button disabled={!!busy} onClick={() => act(material.id,'approve')}><ShieldCheck size={14} /> Approve</Button>}
              {!material.publishedMaterialId && status !== 'rejected' && <Button variant="ghost" disabled={!!busy} onClick={() => act(material.id,'reject')}><XCircle size={14} /> Reject</Button>}
              {material.publishedMaterialId && <span className="rounded-lg border border-green-700/40 bg-green-900/20 px-3 py-2 text-center text-xs text-green-300">Published</span>}
            </div>
          </div>
        </Card>
      })}</div>}
  </div>;
}
