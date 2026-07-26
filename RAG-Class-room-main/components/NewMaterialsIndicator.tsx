"use client";
/**
 * Shows how many admin-published materials (matching the student's
 * board/grade/subject preferences) have appeared since they last visited
 * /materials. Two variants, same underlying fetch:
 *   "dot"    — a small badge on the nav link (student layout)
 *   "banner" — a dismissable-by-navigation card on the dashboard
 * Both independently fetch the lightweight /api/student/materials/new-count
 * endpoint — no shared state library in this app, and the endpoint is
 * cheap enough that duplicating the call is simpler than plumbing shared
 * state through the layout tree for what's ultimately a small number.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { studentSession } from "@/lib/student-session";

export function NewMaterialsIndicator({ variant }: { variant: "dot" | "banner" }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const profile = studentSession.get();
    if (!profile) return;
    const since = profile.lastMaterialsCheckAt || new Date(0).toISOString();
    const params = new URLSearchParams({ board: profile.syllabus, grade: profile.grade, since });
    if (profile.languageId) params.set("language", profile.languageId);
    if (profile.subjectPreferences?.length) params.set("subjects", profile.subjectPreferences.join(","));

    fetch(`/api/student/materials/new-count?${params.toString()}`)
      .then(r => r.json())
      .then(d => setCount(d.count || 0))
      .catch(() => {});
  }, []);

  if (count === 0) return null;

  if (variant === "dot") {
    return (
      <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-marigold px-1 font-mono text-[9px] font-bold text-board">
        {count > 9 ? "9+" : count}
      </span>
    );
  }

  return (
    <Link href="/materials" className="mb-6 block">
      <div className="flex items-center gap-3 rounded-xl border border-marigold/40 bg-marigold/10 px-4 py-3 hover:bg-marigold/15 transition-colors">
        <Sparkles size={16} className="text-marigold shrink-0" />
        <div className="text-sm text-chalk">
          <b>{count} new material{count !== 1 ? "s" : ""}</b> from your school — check {count !== 1 ? "them" : "it"} out
        </div>
      </div>
    </Link>
  );
}
