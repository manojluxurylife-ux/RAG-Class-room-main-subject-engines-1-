"use client";
/**
 * AnalyticsCharts — the graphs for the evaluation analytics, rendered
 * with recharts (already a project dependency; no new install).
 *
 * Three visuals, each earning its place:
 *  1. Subject mastery — grouped bars: mastery score vs chapters covered
 *     vs quiz accuracy, per subject. The GAP between the bars is the
 *     story a parent needs: high coverage + low accuracy = rushing;
 *     low coverage + high accuracy = careful but behind.
 *  2. Bloom's ladder — accuracy per Bloom's level in taxonomy order.
 *     Falling bars to the right = the child recalls but can't yet apply,
 *     which is exactly what CBSE's competency push is about.
 *  3. Readiness donut — one glance: how many subjects are on track /
 *     need practice / need focused revision.
 *
 * Charts render only when the underlying attempts exist — an empty
 * chart would be a decorated lie.
 */
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";
import type { ChildAnalytics } from "@/lib/child-analytics";

// Theme tokens (tailwind.config.ts) — recharts needs raw values.
const C = {
  marigold: "#e8a33d", leaf: "#7fb069", blue: "#7fb1cf",
  terracotta: "#d68a63", grid: "#284134", text: "#b9c4ba", card: "#1f3328",
};

const BLOOMS_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
const BLOOMS_LABELS: Record<string, string> = {
  remember: "Remember", understand: "Understand", apply: "Apply",
  analyze: "Analyze", evaluate: "Evaluate", create: "Create",
};

const tooltipStyle = {
  backgroundColor: C.card, border: `1px solid ${C.grid}`, borderRadius: 8,
  fontSize: 12, color: "#f4f1e8",
};

export function SubjectMasteryChart({ data }: { data: ChildAnalytics }) {
  if (data.masteryBySubject.length === 0) return null;
  const rows = data.masteryBySubject.map(m => ({
    subject: m.subject.length > 12 ? m.subject.slice(0, 11) + "…" : m.subject,
    "Mastery score": m.masteryScore,
    "Chapters covered %": m.completionPct,
    "Quiz accuracy %": m.quizAccuracyPct ?? 0,
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="subject" tick={{ fill: C.text, fontSize: 11 }} stroke={C.grid} />
          <YAxis domain={[0, 100]} tick={{ fill: C.text, fontSize: 10 }} stroke={C.grid} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(232,163,61,0.06)" }} />
          <Legend wrapperStyle={{ fontSize: 11, color: C.text }} />
          <Bar dataKey="Mastery score"      fill={C.marigold} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Chapters covered %" fill={C.blue}     radius={[3, 3, 0, 0]} />
          <Bar dataKey="Quiz accuracy %"    fill={C.leaf}     radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BloomsChart({ data }: { data: ChildAnalytics }) {
  if (data.bloomsMapping.length === 0) return null;
  const rows = [...data.bloomsMapping]
    .sort((a, b) => BLOOMS_ORDER.indexOf(a.level) - BLOOMS_ORDER.indexOf(b.level))
    .map(b => ({
      level: BLOOMS_LABELS[b.level] || b.level,
      "Accuracy %": b.accuracyPct ?? 0,
      attempts: b.attempts,
    }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="level" tick={{ fill: C.text, fontSize: 10 }} stroke={C.grid} />
          <YAxis domain={[0, 100]} tick={{ fill: C.text, fontSize: 10 }} stroke={C.grid} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "rgba(232,163,61,0.06)" }}
            formatter={(value: any, _name: any, entry: any) =>
              [`${value}% correct · ${entry?.payload?.attempts} attempts`, "Accuracy"]}
          />
          <Bar dataKey="Accuracy %" fill={C.marigold} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReadinessDonut({ data }: { data: ChildAnalytics }) {
  if (data.readinessBySubject.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const r of data.readinessBySubject) counts[r.readiness] = (counts[r.readiness] || 0) + 1;
  const rows = [
    { name: "On Track",               value: counts["On Track"] || 0,               color: C.leaf },
    { name: "Needs More Practice",    value: counts["Needs More Practice"] || 0,    color: C.blue },
    { name: "Needs Focused Revision", value: counts["Needs Focused Revision"] || 0, color: C.terracotta },
  ].filter(r => r.value > 0);
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name"
            innerRadius="55%" outerRadius="80%" paddingAngle={3} stroke={C.card}>
            {rows.map(r => <Cell key={r.name} fill={r.color} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle}
            formatter={(v: any, n: any) => [`${v} subject${v !== 1 ? "s" : ""}`, n]} />
          <Legend wrapperStyle={{ fontSize: 11, color: C.text }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
