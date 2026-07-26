"use client";
/**
 * Parent's Corner — the parent portal's evaluation analytics, INSIDE the
 * student app. The realistic Indian-household case this serves: the
 * child studies on the family's one phone, and the parent picks up that
 * same phone to see "how is my child actually doing?" — without needing
 * a separate parent-portal account, a second login, or another device.
 *
 * Shows the SAME eight analytics as app/parent/children/[childId]
 * (Mastery score, Exam readiness, Weak topics, Study plan, Revision
 * schedule, Bloom's breakdown, Competency mapping, Learning objectives)
 * through the same shared view and the same shared computation — one
 * source of truth, two doors.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users, ArrowRight } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { studentSession } from "@/lib/student-session";
import { EvaluationAnalytics } from "@/components/EvaluationAnalytics";
import type { ChildAnalytics } from "@/lib/child-analytics";

export default function ParentCornerPage() {
  const [data,    setData]    = useState<ChildAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    const profile = studentSession.get();
    if (!profile) { setError("Please log in as a student first."); setLoading(false); return; }
    fetch(`/api/student/analytics?studentId=${encodeURIComponent(profile.email)}`)
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        setData(json);
      })
      .catch(e => setError(e.message || "Could not load the evaluation."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="For parents"
        title="Parent's Corner"
        subtitle="How your child is really doing — every number below comes from work they actually completed, nothing is estimated or invented."
      />

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-chalkdim">
          <Loader2 size={16} className="animate-spin" /> Preparing the evaluation…
        </div>
      ) : error || !data ? (
        <Card><p className="text-sm text-terracotta">{error || "Could not load the evaluation."}</p></Card>
      ) : (
        <>
          <div className="mb-5 rounded-lg border border-board3 bg-board2 px-4 py-2.5 text-xs text-chalkdim">
            👋 Evaluation for <b className="text-chalk">{data.student.name}</b> · Class {data.student.className} · {data.student.syllabus.toUpperCase()}
          </div>

          <EvaluationAnalytics data={data} deviceNote="student-device" />

          {/* The full portal still exists for parents with their own
              device/account — multiple children, consent, billing. */}
          <Link href="/parent/dashboard" className="mt-5 block">
            <Card className="flex items-center justify-between py-3 hover:border-marigold/60 transition-colors">
              <div className="flex items-center gap-2 text-sm text-chalk">
                <Users size={15} className="text-marigold" />
                Have your own phone? Use the full Parent Portal — link multiple children, manage consent
              </div>
              <ArrowRight size={14} className="text-chalkdim" />
            </Card>
          </Link>
        </>
      )}
    </div>
  );
}
