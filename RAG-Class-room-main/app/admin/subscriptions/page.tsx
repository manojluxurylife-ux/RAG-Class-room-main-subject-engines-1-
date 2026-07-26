"use client";
/**
 * Admin › Subscriptions — the subscription-management portal, patterned
 * on Meteroid (meteroid-oss/meteroid, open-source billing infrastructure):
 * lifecycle control (cancel now / at period end, pause, resume,
 * reactivate, extend trial, upgrade/downgrade), plans, coupons, and MRR
 * movement analytics (Meteroid's NewBusiness/Expansion/Contraction/
 * Churn/Reactivation ledger).
 *
 * Access: admin-only, twice over — middleware.ts requires a verified
 * (HMAC-signed) admin session for both this page (/admin/*) and every
 * API it calls (/api/admin/*). A forged or role-less cookie gets a
 * login redirect here and a 401 there.
 */
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Loader2, Plus, Ticket, Layers, TrendingUp } from "lucide-react";
import { Card, PageHeader, StatCard, EmptyState } from "@/components/ui";

interface Subscription {
  id: string; studentName: string; studentEmail: string; plan: string;
  amountPaise: number; status: string; startedAt: string; currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
}
interface Plan { id: string; name: string; amountPaise: number; interval: string; trialDays: number; active: boolean }
interface Coupon { id: string; code: string; percentOff: number; maxRedemptions: number; redeemed: number; expiresAt?: string; active: boolean }
interface MrrRow { month: string; new_business: number; expansion: number; contraction: number; churn: number; reactivation: number }

function rupees(paise: number) { return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`; }
function shortDate(iso: string) { const d = new Date(iso); return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }

const STATUS_PILL: Record<string, string> = {
  active:    "text-marigold border-marigold/40 bg-marigold/10",
  trialing:  "text-blue border-blue/40 bg-blue/10",
  paused:    "text-chalkdim border-board3 bg-board",
  past_due:  "text-terracotta border-terracotta/40 bg-terracotta/10",
  cancelled: "text-terracotta border-terracotta/40 bg-terracotta/10",
  completed: "text-leaf border-leaf/40 bg-leaf/10",
};

const tooltipStyle = { backgroundColor: "#1f3328", border: "1px solid #284134", borderRadius: 8, fontSize: 12, color: "#f4f1e8" };

export default function AdminSubscriptionsPage() {
  const [subs,      setSubs]      = useState<Subscription[]>([]);
  const [stats,     setStats]     = useState<{ totalSubscriptions: number; activeSubscriptions: number; mrrPaise: number; churnRate: number } | null>(null);
  const [movements, setMovements] = useState<MrrRow[]>([]);
  const [plans,     setPlans]     = useState<Plan[]>([]);
  const [coupons,   setCoupons]   = useState<Coupon[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busyId,    setBusyId]    = useState<string | null>(null);
  const [error,     setError]     = useState("");

  // New plan / coupon mini-forms
  const [npName, setNpName] = useState(""); const [npPrice, setNpPrice] = useState("");
  const [npInterval, setNpInterval] = useState<"monthly" | "annual">("monthly");
  const [npTrial, setNpTrial] = useState("7");
  const [ncCode, setNcCode] = useState(""); const [ncPct, setNcPct] = useState(""); const [ncMax, setNcMax] = useState("");

  async function loadAll() {
    const [s, p, c] = await Promise.all([
      fetch("/api/admin/subscriptions").then(r => r.json()),
      fetch("/api/admin/plans").then(r => r.json()),
      fetch("/api/admin/coupons").then(r => r.json()),
    ]);
    setSubs(s.subscriptions || []); setStats(s.stats || null); setMovements(s.mrrMovements || []);
    setPlans(p.plans || []); setCoupons(c.coupons || []);
  }
  useEffect(() => { loadAll().finally(() => setLoading(false)); }, []);

  async function act(id: string, action: string, planId?: string) {
    setBusyId(id); setError("");
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadAll();
    } catch (e: any) { setError(e.message || "Action failed."); }
    finally { setBusyId(null); }
  }

  async function createPlan() {
    const amountPaise = Math.round(parseFloat(npPrice) * 100);
    if (!npName.trim() || !amountPaise) return;
    await fetch("/api/admin/plans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: npName.trim(), amountPaise, interval: npInterval, trialDays: parseInt(npTrial) || 0 }),
    });
    setNpName(""); setNpPrice(""); await loadAll();
  }

  async function createCoupon() {
    const percentOff = parseInt(ncPct);
    if (!ncCode.trim() || !percentOff) return;
    await fetch("/api/admin/coupons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ncCode.trim(), percentOff, maxRedemptions: parseInt(ncMax) || 0 }),
    });
    setNcCode(""); setNcPct(""); setNcMax(""); await loadAll();
  }

  async function togglePlan(p: Plan)  { await fetch("/api/admin/plans",   { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, active: !p.active }) }); await loadAll(); }
  async function toggleCoupon(c: Coupon) { await fetch("/api/admin/coupons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, active: !c.active }) }); await loadAll(); }

  if (loading) return <div className="flex items-center gap-2 py-10 text-sm text-chalkdim"><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  const mrrChart = movements.map(m => ({
    month: m.month.slice(5) + "/" + m.month.slice(2, 4),
    "New": m.new_business / 100, "Expansion": m.expansion / 100, "Reactivation": m.reactivation / 100,
    "Contraction": -m.contraction / 100, "Churn": -m.churn / 100,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Subscriptions"
        subtitle="Plans, coupons, lifecycle control and MRR analytics — patterned on Meteroid's open-source billing model."
      />

      {/* ── Headline metrics ── */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="MRR" value={rupees(stats.mrrPaise)} />
          <StatCard label="Active + trialing" value={String(stats.activeSubscriptions)} />
          <StatCard label="All subscriptions" value={String(stats.totalSubscriptions)} />
          <StatCard label="Churn (30d)" value={`${Math.round(stats.churnRate * 100)}%`} />
        </div>
      )}

      {/* ── MRR movements — why MRR changed, not just that it did ── */}
      <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
        <TrendingUp size={16} className="text-marigold" /> MRR movements (last 6 months)
      </div>
      <Card className="mb-6">
        {mrrChart.every(r => !r.New && !r.Expansion && !r.Churn && !r.Contraction && !r.Reactivation) ? (
          <p className="text-sm text-chalkdim">No subscription activity yet — movements appear as subscriptions start, change plan, cancel or reactivate.</p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <BarChart data={mrrChart} stackOffset="sign" margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="#284134" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#b9c4ba", fontSize: 10 }} stroke="#284134" />
                <YAxis tick={{ fill: "#b9c4ba", fontSize: 10 }} stroke="#284134" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [`₹${Math.abs(v).toLocaleString("en-IN")}`, n]} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#b9c4ba" }} />
                <Bar dataKey="New"          stackId="mrr" fill="#7fb069" />
                <Bar dataKey="Expansion"    stackId="mrr" fill="#7fb1cf" />
                <Bar dataKey="Reactivation" stackId="mrr" fill="#e8a33d" />
                <Bar dataKey="Contraction"  stackId="mrr" fill="#c48a7a" />
                <Bar dataKey="Churn"        stackId="mrr" fill="#d68a63" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {error && <div className="mb-3 text-xs text-terracotta">{error}</div>}

      {/* ── Subscriptions table with lifecycle actions ── */}
      <div className="mb-3 font-display text-base text-chalk">All subscriptions</div>
      {subs.length === 0 ? (
        <Card className="mb-6"><EmptyState text="No subscriptions yet — manually recorded and (later) Razorpay-webhook subscriptions will appear here." /></Card>
      ) : (
        <div className="mb-6 flex flex-col gap-2">
          {subs.map(s => (
            <Card key={s.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-chalk">{s.studentName} <span className="font-mono text-[10px] text-chalkdim">{s.studentEmail}</span></div>
                  <div className="font-mono text-[10px] text-chalkdim">
                    {s.plan} · {rupees(s.amountPaise)} · since {shortDate(s.startedAt)} · period ends {shortDate(s.currentPeriodEnd)}
                    {s.cancelAtPeriodEnd && " · ends then (cancel scheduled)"}
                  </div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${STATUS_PILL[s.status] || "text-chalkdim border-board3"}`}>
                  {s.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {busyId === s.id ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-chalkdim"><Loader2 size={11} className="animate-spin" /> Working…</span>
                ) : (
                  <>
                    {(s.status === "active" || s.status === "trialing") && !s.cancelAtPeriodEnd && (
                      <>
                        <ActionBtn onClick={() => act(s.id, "cancel_period_end")}>Cancel at period end</ActionBtn>
                        <ActionBtn onClick={() => act(s.id, "cancel_now")} danger>Cancel now</ActionBtn>
                        <ActionBtn onClick={() => act(s.id, "pause")}>Pause</ActionBtn>
                      </>
                    )}
                    {s.status === "trialing" && <ActionBtn onClick={() => act(s.id, "extend_trial")}>Extend trial +7d</ActionBtn>}
                    {s.status === "paused" && <ActionBtn onClick={() => act(s.id, "resume")}>Resume</ActionBtn>}
                    {(s.status === "cancelled" || s.cancelAtPeriodEnd) && <ActionBtn onClick={() => act(s.id, "reactivate")}>Reactivate</ActionBtn>}
                    {(s.status === "active" || s.status === "trialing") && plans.filter(p => p.active && p.name !== s.plan).map(p => (
                      <ActionBtn key={p.id} onClick={() => act(s.id, "change_plan", p.id)}>
                        → {p.name} ({rupees(p.amountPaise)})
                      </ActionBtn>
                    ))}
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Plans ── */}
      <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
        <Layers size={16} className="text-marigold" /> Plans
      </div>
      <Card className="mb-6">
        <div className="mb-3 flex flex-col gap-2">
          {plans.map(p => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-board3 pb-2 last:border-none last:pb-0">
              <span className="text-sm text-chalk">{p.name}</span>
              <span className="font-mono text-[10px] text-chalkdim">{rupees(p.amountPaise)} / {p.interval} · {p.trialDays}d trial</span>
              <button onClick={() => togglePlan(p)}
                className={`ml-auto rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${p.active ? "text-leaf border-leaf/40 bg-leaf/10" : "text-chalkdim border-board3"}`}>
                {p.active ? "Selling" : "Hidden"}
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-board3 pt-3">
          <input value={npName} onChange={e => setNpName(e.target.value)} placeholder="Plan name"
            className="w-36 rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk" />
          <input value={npPrice} onChange={e => setNpPrice(e.target.value)} placeholder="₹ price" inputMode="decimal"
            className="w-24 rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk" />
          <select value={npInterval} onChange={e => setNpInterval(e.target.value as any)}
            className="rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk">
            <option value="monthly">monthly</option><option value="annual">annual</option>
          </select>
          <input value={npTrial} onChange={e => setNpTrial(e.target.value)} placeholder="Trial days" inputMode="numeric"
            className="w-24 rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk" />
          <button onClick={createPlan}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marigold px-3 py-2 font-mono text-[10px] font-semibold text-board hover:bg-marigolddim">
            <Plus size={11} /> Add plan
          </button>
        </div>
        <p className="mt-2 text-[11px] text-chalkdim">
          Price changes only affect new subscriptions — existing subscribers keep the price they signed up at (grandfathering).
        </p>
      </Card>

      {/* ── Coupons ── */}
      <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
        <Ticket size={16} className="text-marigold" /> Coupons
      </div>
      <Card>
        {coupons.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {coupons.map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 border-b border-board3 pb-2 last:border-none last:pb-0">
                <span className="font-mono text-sm text-marigold">{c.code}</span>
                <span className="font-mono text-[10px] text-chalkdim">
                  {c.percentOff}% off · {c.redeemed}{c.maxRedemptions > 0 ? `/${c.maxRedemptions}` : ""} used
                </span>
                <button onClick={() => toggleCoupon(c)}
                  className={`ml-auto rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${c.active ? "text-leaf border-leaf/40 bg-leaf/10" : "text-chalkdim border-board3"}`}>
                  {c.active ? "Active" : "Disabled"}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2 border-t border-board3 pt-3">
          <input value={ncCode} onChange={e => setNcCode(e.target.value.toUpperCase())} placeholder="CODE"
            className="w-32 rounded-lg border border-board3 bg-board px-2.5 py-2 font-mono text-xs text-chalk" />
          <input value={ncPct} onChange={e => setNcPct(e.target.value)} placeholder="% off" inputMode="numeric"
            className="w-20 rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk" />
          <input value={ncMax} onChange={e => setNcMax(e.target.value)} placeholder="Max uses (0=∞)" inputMode="numeric"
            className="w-32 rounded-lg border border-board3 bg-board px-2.5 py-2 text-xs text-chalk" />
          <button onClick={createCoupon}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marigold px-3 py-2 font-mono text-[10px] font-semibold text-board hover:bg-marigolddim">
            <Plus size={11} /> Add coupon
          </button>
        </div>
      </Card>
    </div>
  );
}

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] transition-colors ${
        danger
          ? "border-terracotta/40 bg-terracotta/10 text-terracotta hover:bg-terracotta/20"
          : "border-board3 bg-board text-chalkdim hover:text-marigold hover:border-marigold/50"
      }`}>
      {children}
    </button>
  );
}
