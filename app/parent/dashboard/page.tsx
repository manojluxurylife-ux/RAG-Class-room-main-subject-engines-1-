"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, PageHeader } from "@/components/ui";
import { Loader2, ArrowRight } from "lucide-react";

interface Child {
  id: string; name: string; className: string; syllabus: string;
  lastActiveAt: string; materialsCount: number; overallCompletionPct: number;
}

const BOARD_LABELS: Record<string, string> = {
  cbse: "CBSE", kerala: "Kerala State", tamilnadu: "Tamil Nadu", karnataka: "Karnataka",
};

export default function ParentDashboard() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(async (d) => {
      if (!d.session || d.session.role !== "parent") { router.push("/login"); return; }
      const res = await fetch(`/api/parent/children?parentId=${d.session.userId}`);
      const data = await res.json();
      setChildren(data.children || []);
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return <div className="flex items-center gap-2 py-10 text-sm text-chalkdim"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  }

  return (
    <div>
      <PageHeader eyebrow="Parent" title="Your children" />

      {children.length === 0 ? (
        <Card>
          <p className="mb-4 text-sm text-chalkdim">
            You haven't linked a child's account yet. Once linked, you'll see their real quiz
            results, topics covered, weak areas, and study recommendations here.
          </p>
          <Link href="/parent/children/add"><Button>+ Add a child</Button></Link>
        </Card>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3">
            {children.map((c) => (
              <Link key={c.id} href={`/parent/children/${c.id}`}>
                <Card className="flex items-center justify-between hover:border-marigold/60 transition-colors">
                  <div>
                    <div className="font-display text-lg text-chalk">{c.name}</div>
                    <div className="text-xs text-chalkdim">
                      Class {c.className} · {BOARD_LABELS[c.syllabus] || c.syllabus} · {c.materialsCount} material{c.materialsCount !== 1 ? "s" : ""}
                    </div>
                    <div className="mt-1.5 h-1 w-40 rounded-full bg-board3 overflow-hidden">
                      <div className="h-full bg-marigold" style={{ width: `${c.overallCompletionPct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-chalkdim">{c.overallCompletionPct}% complete</span>
                    <ArrowRight size={16} className="text-chalkdim" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <Link href="/parent/children/add">
            <Button variant="ghost">+ Add another child</Button>
          </Link>
        </>
      )}
    </div>
  );
}
