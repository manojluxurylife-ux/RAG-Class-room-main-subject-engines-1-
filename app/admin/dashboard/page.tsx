"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Users, IndianRupee, Download, MessageCircle, Loader2 } from "lucide-react";
import { PageHeader, StatCard, Card } from "@/components/ui";

const COLORS = ["#e8a33d", "#7fb1cf", "#d68a63", "#b97f26", "#284134"];

function formatRupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

interface DashboardStats {
  students: {
    total: number; activeLast7d: number; newLast7d: number; newLast30d: number;
    bySyllabus: Record<string, number>; byLanguage: Record<string, number>;
    byGrade: Record<string, number>; byState: Record<string, number>;
  };
  subscriptions: { totalSubscriptions: number; activeSubscriptions: number; mrrPaise: number; churnRate: number };
  downloads: { total: number; last7d: number; topMaterials: { materialId: string; title: string; count: number }[] };
  messages: { total: number; open: number; resolved: number };
  signupsByDay: { date: string; count: number }[];
  revenueByDay: { date: string; amountPaise: number }[];
}

export default function AdminDashboard() {
  const [stats,   setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setStats(d); })
      .catch(e => setError(e.message || "Could not load stats."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-chalkdim">
        <Loader2 size={18} className="animate-spin" /> Loading business data…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div>
        <PageHeader eyebrow="Admin" title="System overview" />
        <Card>
          <p className="text-sm text-terracotta">{error || "Something went wrong."}</p>
          <p className="mt-2 text-xs text-chalkdim">
            Make sure GOOGLE_CLOUD_KEY_JSON and GOOGLE_CLOUD_PROJECT_ID are set (see .env.example) —
            this dashboard reads from Firestore.
          </p>
        </Card>
      </div>
    );
  }

  const syllabusData = Object.entries(stats.students.bySyllabus).map(([name, value]) => ({ name, value }));
  const languageData = Object.entries(stats.students.byLanguage).map(([name, value]) => ({ name, value }));
  const signupChartData = stats.signupsByDay.map(d => ({ ...d, label: formatShortDate(d.date) }));
  const revenueChartData = stats.revenueByDay.map(d => ({ ...d, label: formatShortDate(d.date), rupees: d.amountPaise / 100 }));

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Business overview" subtitle="Live from Firestore — every student, payment, and download." />

      {/* ── Top stat cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total students" value={String(stats.students.total)} />
        <StatCard label="MRR" value={formatRupees(stats.subscriptions.mrrPaise)} />
        <StatCard label="Active subscriptions" value={String(stats.subscriptions.activeSubscriptions)} />
        <StatCard label="Open complaints" value={String(stats.messages.open)} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="New (7 days)" value={String(stats.students.newLast7d)} />
        <StatCard label="Active (7 days)" value={String(stats.students.activeLast7d)} />
        <StatCard label="Downloads (7 days)" value={String(stats.downloads.last7d)} />
        <StatCard label="Churn rate" value={`${(stats.subscriptions.churnRate * 100).toFixed(1)}%`} />
      </div>

      {/* ── Signups over time ── */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <Users size={15} className="text-marigold" />
          <div className="font-display text-base text-chalk">Signups — last 30 days</div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={signupChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#284134" />
            <XAxis dataKey="label" stroke="#b9c4ba" fontSize={11} tickLine={false} />
            <YAxis stroke="#b9c4ba" fontSize={11} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#1f3328", border: "1px solid #284134", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="count" stroke="#e8a33d" strokeWidth={2} dot={false} name="New students" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Revenue over time ── */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <IndianRupee size={15} className="text-marigold" />
          <div className="font-display text-base text-chalk">Revenue — last 30 days</div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenueChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#284134" />
            <XAxis dataKey="label" stroke="#b9c4ba" fontSize={11} tickLine={false} />
            <YAxis stroke="#b9c4ba" fontSize={11} tickLine={false} tickFormatter={v => `₹${v}`} />
            <Tooltip
              contentStyle={{ background: "#1f3328", border: "1px solid #284134", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]}
            />
            <Bar dataKey="rupees" fill="#e8a33d" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        {/* ── Students by syllabus ── */}
        <Card>
          <div className="mb-4 font-display text-base text-chalk">Students by syllabus</div>
          {syllabusData.length === 0 ? (
            <p className="text-sm text-chalkdim">No students yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={syllabusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {syllabusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1f3328", border: "1px solid #284134", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ── Students by language ── */}
        <Card>
          <div className="mb-4 font-display text-base text-chalk">Students by language</div>
          {languageData.length === 0 ? (
            <p className="text-sm text-chalkdim">No students yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={languageData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {languageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1f3328", border: "1px solid #284134", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Most downloaded materials ── */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Download size={15} className="text-marigold" />
          <div className="font-display text-base text-chalk">Most downloaded materials</div>
        </div>
        {stats.downloads.topMaterials.length === 0 ? (
          <p className="text-sm text-chalkdim">No downloads yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {stats.downloads.topMaterials.map(m => (
              <div key={m.materialId} className="flex items-center justify-between border-b border-board3 py-2 last:border-0">
                <span className="text-sm text-chalk truncate">{m.title}</span>
                <span className="font-mono text-xs text-marigold shrink-0 ml-3">{m.count} downloads</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
