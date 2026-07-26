"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { Card, PageHeader, EmptyState } from "@/components/ui";

interface StudentRow {
  id: string; name: string; email: string; phone: string;
  className: string; syllabus: string; schoolName: string;
  state: string; languageId: string; signedUpAt: string; lastActiveAt: string;
}

const BOARD_LABELS: Record<string, string> = {
  cbse: "CBSE", kerala: "Kerala", tamilnadu: "Tamil Nadu", karnataka: "Karnataka",
};

export default function AdminUsersPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState("");

  useEffect(() => {
    fetch("/api/admin/students")
      .then(r => r.json())
      .then(d => setStudents(d.students || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s => {
    const q = query.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
      || s.phone.includes(q) || s.schoolName.toLowerCase().includes(q);
  });

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  }

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Students" subtitle={`${students.length} registered students`} />

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-chalkdim" />
        <input
          className="w-full rounded-lg border border-board3 bg-board2 pl-9 pr-3.5 py-2.5 text-sm text-chalk placeholder:text-chalkdim/60"
          placeholder="Search by name, email, phone, or school…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-chalkdim">
          <Loader2 size={16} className="animate-spin" /> Loading students…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState text={students.length === 0 ? "No students have signed up yet." : "No matches for that search."} />
      )}

      {!loading && filtered.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-board3 text-left font-mono text-[10px] uppercase tracking-wider text-chalkdim">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Class</th>
                <th className="pb-2 pr-4">Syllabus</th>
                <th className="pb-2 pr-4">School</th>
                <th className="pb-2 pr-4">Signed up</th>
                <th className="pb-2">Last active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-board3 last:border-0 hover:bg-board3/40">
                  <td className="py-2.5 pr-4">
                    <Link href={`/admin/users/${s.id}`} className="text-chalk hover:text-marigold font-medium">
                      {s.name}
                    </Link>
                    <div className="font-mono text-[10px] text-chalkdim">{s.email}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-chalkdim">Class {s.className}</td>
                  <td className="py-2.5 pr-4 text-chalkdim">{BOARD_LABELS[s.syllabus] || s.syllabus}</td>
                  <td className="py-2.5 pr-4 text-chalkdim truncate max-w-[160px]">{s.schoolName}</td>
                  <td className="py-2.5 pr-4 font-mono text-[11px] text-chalkdim">{timeAgo(s.signedUpAt)}</td>
                  <td className="py-2.5 font-mono text-[11px] text-chalkdim">{timeAgo(s.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
