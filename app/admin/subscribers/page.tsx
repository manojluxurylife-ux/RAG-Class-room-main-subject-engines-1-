"use client";
/**
 * Admin › Subscribers — TABLE edition, built for 5,000+ subscribers.
 *
 * The question this page answers in one glance: "how many subscribers
 * in Kollam district / Kerala state / St. Antony's school?" Three
 * mechanisms make that work at scale:
 *
 *  1. FACETED DROPDOWNS WITH COUNTS — every option shows its count
 *     under the OTHER active filters ("Kollam (132)"), so the answer is
 *     visible in the dropdown before you even select it. Selecting
 *     State: Kerala re-counts the District list to Kerala's districts
 *     only — the menus narrow each other like a drill-down.
 *  2. A REAL TABLE — one row per subscriber, sortable columns, sticky
 *     header, horizontal scroll on phones. Click a row for its payment
 *     history in an expandable detail row.
 *  3. PAGINATION — 50 rows per page client-side. At 5,000 subscribers
 *     that's still a single ~1MB fetch, which is fine; if the app ever
 *     passes ~20k, move the filtering server-side (the API shape
 *     already permits it).
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Download, ChevronLeft, ChevronRight, ArrowUpDown, Plus } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";

interface Payment { id: string; at: string; amountPaise: number; status: "paid" | "pending"; note?: string; method?: string }
interface Subscriber {
  id: string; name: string; email: string; phone: string;
  country: string; state: string; district: string; place: string; school: string; className: string;
  plan: string; amountPaise: number; status: string; startedAt: string; currentPeriodEnd: string;
  payments: Payment[]; paymentState: "paid" | "pending" | "none";
}

type FilterKey = "country" | "state" | "district" | "place" | "school" | "className" | "paymentState";
const FILTER_DEFS: { key: FilterKey; label: string }[] = [
  { key: "country",      label: "Country" },
  { key: "state",        label: "State" },
  { key: "district",     label: "District" },
  { key: "place",        label: "Place" },
  { key: "school",       label: "School" },
  { key: "className",    label: "Class" },
  { key: "paymentState", label: "Payment" },
];

const PAGE_SIZE = 50;

function rupees(paise: number) { return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`; }
function dt(iso: string) { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }); }

const PAY_COLOR: Record<string, string> = { paid: "text-leaf", pending: "text-terracotta", none: "text-chalkdim" };
const STATUS_COLOR: Record<string, string> = {
  active: "text-marigold", trialing: "text-blue", paused: "text-chalkdim",
  past_due: "text-terracotta", cancelled: "text-terracotta", completed: "text-leaf",
};

export default function AdminSubscribersPage() {
  const [rows,    setRows]    = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    country: "", state: "", district: "", place: "", school: "", className: "", paymentState: "",
  });
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<keyof Subscriber>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);

  const [openId, setOpenId] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState(""); const [payStatus, setPayStatus] = useState<"paid" | "pending">("paid");
  const [payNote, setPayNote] = useState(""); const [busy, setBusy] = useState(false);

  async function load() {
    const d = await fetch("/api/admin/subscribers").then(r => r.json());
    setRows(d.subscribers || []);
  }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  function matches(r: Subscriber, except?: FilterKey) {
    for (const f of FILTER_DEFS) {
      if (f.key === except) continue;
      const v = filters[f.key];
      if (v && String(r[f.key]) !== v) return false;
    }
    if (q && ![r.name, r.email, r.phone].some(x => x.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }

  /** Faceted options: for each dropdown, distinct values + their count
   *  under all OTHER active filters — this is what makes "how many in
   *  Kollam?" readable straight off the menu. */
  const facets = useMemo(() => {
    const out: Record<FilterKey, { value: string; count: number }[]> = {} as any;
    for (const f of FILTER_DEFS) {
      const counts = new Map<string, number>();
      for (const r of rows) {
        if (!matches(r, f.key)) continue;
        const v = String(r[f.key] || "");
        if (!v || v === "none" && f.key !== "paymentState") continue;
        if (f.key !== "paymentState" && !r[f.key]) continue;
        counts.set(v, (counts.get(v) || 0) + 1);
      }
      out[f.key] = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters, q]);

  const filtered = useMemo(() => {
    const list = rows.filter(r => matches(r));
    list.sort((a, b) => {
      const av = String(a[sortKey] ?? ""), bv = String(b[sortKey] ?? "");
      return av.localeCompare(bv, undefined, { numeric: true }) * sortDir;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters, q, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pendingPaise = filtered.flatMap(r => r.payments.filter(p => p.status === "pending"))
                               .reduce((s, p) => s + p.amountPaise, 0);
  const activeFilterText = FILTER_DEFS
    .filter(f => filters[f.key])
    .map(f => filters[f.key === "className" ? "className" : f.key])
    .join(" › ");

  function setFilter(key: FilterKey, value: string) {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(0);
  }
  function sortBy(key: keyof Subscriber) {
    if (sortKey === key) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }

  async function act(id: string, body: object) {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/subscribers", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      await load();
    } catch (e: any) { setError(e.message || "Action failed."); }
    finally { setBusy(false); }
  }

  function exportCsv() {
    const head = ["Name","Email","Phone","Country","State","District","Place","School","Class","Plan","Amount","Status","Payment"];
    const lines = filtered.map(r => [
      r.name, r.email, r.phone, r.country, r.state, r.district, r.place, r.school, r.className,
      r.plan, (r.amountPaise / 100).toFixed(0), r.status, r.paymentState,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "subscribers.csv"; a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) return <div className="flex items-center gap-2 py-10 text-sm text-chalkdim"><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  const th = "px-2.5 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-chalkdim whitespace-nowrap cursor-pointer select-none hover:text-marigold";
  const td = "px-2.5 py-2 text-xs text-chalk whitespace-nowrap";

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Subscribers"
        subtitle="Pick from the dropdowns to drill down — every option shows its subscriber count. Click a column to sort, click a row for payment history."
      />

      {/* ── Faceted dropdowns with counts ── */}
      <Card className="mb-3">
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {FILTER_DEFS.map(f => (
            <div key={f.key}>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-chalkdim">{f.label}</div>
              <select
                value={filters[f.key]}
                onChange={e => setFilter(f.key, e.target.value)}
                className={`w-full rounded-lg border bg-board px-2 py-1.5 text-xs ${filters[f.key] ? "border-marigold/60 text-marigold" : "border-board3 text-chalk"}`}>
                <option value="">All ({rows.filter(r => matches(r, f.key)).length})</option>
                {facets[f.key].map(o => (
                  <option key={o.value} value={o.value}>
                    {f.key === "className" ? `Class ${o.value}` : o.value} ({o.count})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-board3 bg-board px-2.5 py-2">
            <Search size={13} className="text-chalkdim" />
            <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Search name, email or phone…"
              className="w-full bg-transparent text-xs text-chalk outline-none placeholder:text-chalkdim/60" />
          </div>
          <button onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-board3 bg-board px-3 py-2 font-mono text-[10px] text-chalkdim hover:text-marigold hover:border-marigold/50 transition-colors">
            <Download size={11} /> CSV ({filtered.length})
          </button>
        </div>
      </Card>

      {/* ── The answer line ── */}
      <div className="mb-3 rounded-lg border border-marigold/40 bg-marigold/10 px-3.5 py-2.5 text-sm text-chalk">
        <b className="font-mono text-marigold">{filtered.length.toLocaleString("en-IN")}</b> subscriber{filtered.length !== 1 ? "s" : ""}
        {activeFilterText && <> in <b className="text-marigold">{activeFilterText}</b></>}
        {pendingPaise > 0 && <span className="font-mono text-[11px] text-chalkdim"> · {rupees(pendingPaise)} pending</span>}
      </div>

      {error && <div className="mb-3 text-xs text-terracotta">{error}</div>}

      {/* ── Table ── */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-board2">
              <tr className="border-b border-board3">
                {([
                  ["name", "Name"], ["email", "Email"], ["phone", "Phone"],
                  ["district", "District"], ["state", "State"],
                  ["school", "School"], ["className", "Class"],
                  ["plan", "Plan"], ["status", "Status"], ["paymentState", "Payment"],
                ] as [keyof Subscriber, string][]).map(([k, label]) => (
                  <th key={k} className={th} onClick={() => sortBy(k)}>
                    <span className="inline-flex items-center gap-1">{label}
                      <ArrowUpDown size={9} className={sortKey === k ? "text-marigold" : "opacity-40"} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-sm text-chalkdim">No subscribers match this selection.</td></tr>
              )}
              {pageRows.map((r, i) => (
                <SubRow key={r.id} r={r} zebra={i % 2 === 1}
                  open={openId === r.id}
                  onToggle={() => setOpenId(openId === r.id ? null : r.id)}
                  busy={busy} act={act}
                  payAmt={payAmt} setPayAmt={setPayAmt}
                  payStatus={payStatus} setPayStatus={setPayStatus}
                  payNote={payNote} setPayNote={setPayNote} />
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-board3 px-3 py-2">
            <span className="font-mono text-[10px] text-chalkdim">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString("en-IN")}
            </span>
            <div className="flex items-center gap-1.5">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="rounded-lg border border-board3 bg-board p-1.5 text-chalkdim hover:text-chalk disabled:opacity-40">
                <ChevronLeft size={13} />
              </button>
              <span className="font-mono text-[10px] text-chalkdim">page {page + 1}/{pages}</span>
              <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
                className="rounded-lg border border-board3 bg-board p-1.5 text-chalkdim hover:text-chalk disabled:opacity-40">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function SubRow({ r, zebra, open, onToggle, busy, act, payAmt, setPayAmt, payStatus, setPayStatus, payNote, setPayNote }: {
  r: Subscriber; zebra: boolean; open: boolean; onToggle: () => void; busy: boolean;
  act: (id: string, body: object) => void;
  payAmt: string; setPayAmt: (v: string) => void;
  payStatus: "paid" | "pending"; setPayStatus: (v: "paid" | "pending") => void;
  payNote: string; setPayNote: (v: string) => void;
}) {
  const td = "px-2.5 py-2 text-xs whitespace-nowrap";
  return (
    <>
      <tr onClick={onToggle}
        className={`cursor-pointer border-b border-board3/60 hover:bg-board3/30 ${zebra ? "bg-board/40" : ""} ${open ? "bg-marigold/5" : ""}`}>
        <td className={`${td} text-chalk`}>{r.name}</td>
        <td className={`${td} font-mono text-[10px] text-chalkdim`}>{r.email}</td>
        <td className={`${td} font-mono text-[10px] text-chalkdim`}>{r.phone || "—"}</td>
        <td className={`${td} text-chalkdim`}>{r.district || "—"}</td>
        <td className={`${td} text-chalkdim`}>{r.state || "—"}</td>
        <td className={`${td} text-chalkdim`}>{r.school || "—"}</td>
        <td className={`${td} text-chalkdim`}>{r.className || "—"}</td>
        <td className={`${td} text-chalkdim`}>{r.plan} · {rupees(r.amountPaise)}</td>
        <td className={`${td} font-mono text-[10px] ${STATUS_COLOR[r.status] || "text-chalkdim"}`}>{r.status}</td>
        <td className={`${td} font-mono text-[10px] ${PAY_COLOR[r.paymentState]}`}>{r.paymentState === "none" ? "no payments" : r.paymentState}</td>
      </tr>
      {open && (
        <tr className="border-b border-board3">
          <td colSpan={10} className="bg-board px-3 py-3">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-chalkdim">
              Payment history — {r.place && `${r.place}, `}{r.district}{r.state && `, ${r.state}`}
            </div>
            {r.payments.length === 0 ? (
              <p className="mb-2 text-xs text-chalkdim">No payments recorded yet.</p>
            ) : (
              <div className="mb-2 flex flex-col gap-1">
                {r.payments.map(p => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 text-xs text-chalkdim">
                    <span className="font-mono text-[10px]">{dt(p.at)}</span>
                    <span className="text-chalk">{rupees(p.amountPaise)}</span>
                    {(p.method || p.note) && <span className="font-mono text-[10px]">· {[p.method, p.note].filter(Boolean).join(" — ")}</span>}
                    <span className={`ml-auto font-mono text-[10px] ${PAY_COLOR[p.status]}`}>{p.status}</span>
                    {p.status === "pending" && (
                      <button disabled={busy}
                        onClick={e => { e.stopPropagation(); act(r.id, { action: "mark_paid", paymentId: p.id }); }}
                        className="rounded-lg border border-leaf/40 bg-leaf/10 px-2 py-0.5 font-mono text-[10px] text-leaf hover:bg-leaf/20 disabled:opacity-50">
                        Mark paid
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-board3 pt-2" onClick={e => e.stopPropagation()}>
              <input value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="₹ amount" inputMode="decimal"
                className="w-24 rounded-lg border border-board3 bg-board2 px-2.5 py-1.5 text-xs text-chalk" />
              <select value={payStatus} onChange={e => setPayStatus(e.target.value as any)}
                className="rounded-lg border border-board3 bg-board2 px-2.5 py-1.5 text-xs text-chalk">
                <option value="paid">paid</option><option value="pending">pending</option>
              </select>
              <input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Note (UPI / cash / ref)"
                className="w-40 rounded-lg border border-board3 bg-board2 px-2.5 py-1.5 text-xs text-chalk" />
              <button disabled={busy || !parseFloat(payAmt)}
                onClick={() => { act(r.id, { action: "add_payment", amountPaise: Math.round(parseFloat(payAmt) * 100), status: payStatus, note: payNote || undefined }); setPayAmt(""); setPayNote(""); }}
                className="inline-flex items-center gap-1 rounded-lg bg-marigold px-2.5 py-1.5 font-mono text-[10px] font-semibold text-board hover:bg-marigolddim disabled:opacity-50">
                <Plus size={10} /> Record
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
