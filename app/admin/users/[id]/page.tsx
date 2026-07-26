"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Download, IndianRupee } from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/ui";

interface StudentDetail {
  student: {
    id: string; name: string; email: string; phone: string;
    className: string; syllabus: string; schoolName: string;
    country: string; state: string; district: string; place: string;
    languageId: string; signedUpAt: string; lastActiveAt: string;
  };
  subscriptions: { id: string; plan: string; amountPaise: number; status: string; startedAt: string }[];
  downloads: { id: string; materialTitle: string; downloadedAt: string }[];
}

function formatRupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function StudentDetailPage() {
  const params = useParams();
  const [data,    setData]    = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch(`/api/admin/students/${params.id}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <div className="flex items-center gap-2 py-16 text-chalkdim"><Loader2 size={18} className="animate-spin" /> Loading…</div>;
  }
  if (error || !data) {
    return <Card><p className="text-sm text-terracotta">{error || "Student not found."}</p></Card>;
  }

  const { student, subscriptions, downloads } = data;
  const totalPaid = subscriptions.reduce((sum, s) => sum + (s.status === "active" || s.status === "trialing" ? s.amountPaise : 0), 0);

  return (
    <div>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-xs text-chalkdim hover:text-chalk">
        <ArrowLeft size={12} /> Back to students
      </Link>
      <PageHeader eyebrow="Student profile" title={student.name} />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Total paid" value={formatRupees(totalPaid)} />
        <StatCard label="Downloads" value={String(downloads.length)} />
        <StatCard label="Subscriptions" value={String(subscriptions.length)} />
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <div className="mb-3 font-display text-base text-chalk">Contact & school</div>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Email" value={student.email} />
            <Row label="Phone" value={student.phone} />
            <Row label="Class" value={`Class ${student.className}`} />
            <Row label="Syllabus" value={student.syllabus} />
            <Row label="School" value={student.schoolName} />
            <Row label="Location" value={[student.place, student.district, student.state, student.country].filter(Boolean).join(", ")} />
            <Row label="Language" value={student.languageId} />
            <Row label="Signed up" value={new Date(student.signedUpAt).toLocaleDateString("en-IN")} />
            <Row label="Last active" value={new Date(student.lastActiveAt).toLocaleDateString("en-IN")} />
          </dl>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
            <IndianRupee size={15} className="text-marigold" /> Payment history
          </div>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-chalkdim">No payments recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {subscriptions.map(s => (
                <div key={s.id} className="flex items-center justify-between border-b border-board3 py-2 last:border-0 text-sm">
                  <div>
                    <div className="text-chalk">{s.plan.replace("_", " ")}</div>
                    <div className="font-mono text-[10px] text-chalkdim">{new Date(s.startedAt).toLocaleDateString("en-IN")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-marigold">{formatRupees(s.amountPaise)}</div>
                    <div className={`font-mono text-[10px] ${s.status === "active" ? "text-marigold" : "text-chalkdim"}`}>{s.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2 font-display text-base text-chalk">
          <Download size={15} className="text-marigold" /> Download history
        </div>
        {downloads.length === 0 ? (
          <p className="text-sm text-chalkdim">No downloads yet.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {downloads.map(d => (
              <div key={d.id} className="flex items-center justify-between border-b border-board3 py-2 last:border-0 text-sm">
                <span className="text-chalk">{d.materialTitle}</span>
                <span className="font-mono text-[10px] text-chalkdim">{new Date(d.downloadedAt).toLocaleDateString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-chalkdim shrink-0">{label}</dt>
      <dd className="text-chalk text-right">{value || "—"}</dd>
    </div>
  );
}
