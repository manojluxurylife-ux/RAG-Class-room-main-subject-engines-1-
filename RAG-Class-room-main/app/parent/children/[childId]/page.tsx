"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { Loader2 } from "lucide-react";
import { EvaluationAnalytics } from "@/components/EvaluationAnalytics";
import type { ChildAnalytics } from "@/lib/child-analytics";

export default function ChildProgressPage({ params }: { params: { childId: string } }) {
  const router = useRouter();
  const [data, setData] = useState<ChildAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(async (d) => {
      if (!d.session || d.session.role !== "parent") { router.push("/login"); return; }
      const res = await fetch(`/api/parent/child-analytics?parentId=${d.session.userId}&studentId=${params.childId}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Could not load progress."); setLoading(false); return; }
      setData(json);
      setLoading(false);
    });
  }, [router, params.childId]);

  if (loading) return <div className="flex items-center gap-2 py-10 text-sm text-chalkdim"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (error || !data) return <Card><p className="text-sm text-terracotta">{error || "Could not load this child's progress."}</p></Card>;

  return (
    <div>
      <PageHeader eyebrow="Progress" title={`${data.student.name}'s progress`} subtitle={`Class ${data.student.className}`} />
      {/* The eight analytics — shared view (components/EvaluationAnalytics),
          identical to the student app's Parent's Corner page. */}
      <EvaluationAnalytics data={data} deviceNote="parent" />
    </div>
  );
}
