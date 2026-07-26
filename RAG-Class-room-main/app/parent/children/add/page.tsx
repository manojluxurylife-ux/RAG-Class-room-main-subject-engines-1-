"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card, Button } from "@/components/ui";
import { Loader2, UserPlus, CheckCircle2 } from "lucide-react";

export default function AddChildPage() {
  const router = useRouter();
  const [parentId, setParentId] = useState<string | null>(null);
  const [childEmail, setChildEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linked, setLinked] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.session || d.session.role !== "parent") { router.push("/login"); return; }
      setParentId(d.session.userId);
    });
  }, [router]);

  async function link() {
    if (!parentId || !childEmail.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/parent/link-child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId, childEmail: childEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinked(data.link.studentName);
      setChildEmail("");
    } catch (e: any) {
      setError(e.message || "Could not link this child.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="New link" title="Add a child" />
      <Card>
        <p className="mb-4 text-sm text-chalkdim">
          Enter your child's AI Guru login email — the same one they use to sign in themselves.
          This links your account to their real progress; it doesn't create a new student account.
        </p>

        {linked && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-marigold/40 bg-marigold/10 px-3.5 py-2.5 text-sm text-chalk">
            <CheckCircle2 size={15} className="text-marigold shrink-0" /> Linked to {linked}'s account.
          </div>
        )}

        <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-chalkdim">Child's email</label>
        <input type="email" className="mb-3 w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
          placeholder="childs.email@example.com"
          value={childEmail} onChange={e => setChildEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && link()} />

        {error && <div className="mb-3 text-xs text-terracotta">{error}</div>}

        <Button onClick={link} disabled={!childEmail.trim() || loading || !parentId}>
          {loading ? <><Loader2 size={14} className="animate-spin" /> Linking…</> : <><UserPlus size={14} /> Link this child</>}
        </Button>

        {linked && (
          <button onClick={() => router.push("/parent/dashboard")}
            className="mt-4 block text-sm text-marigold hover:underline">
            Go to your dashboard →
          </button>
        )}
      </Card>

      <div className="mt-4 rounded-lg border border-board3 bg-board2 px-3.5 py-3 text-xs text-chalkdim">
        A more formal verification step (confirming your child approves the link, and full DPDP Act
        parental-consent tracking) isn't built yet — for now, linking just requires knowing your
        child's own login email.
      </div>
    </div>
  );
}
