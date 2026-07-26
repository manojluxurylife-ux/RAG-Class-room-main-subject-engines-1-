"use client";
/**
 * Official textbook portals directory. Two-step, honest flow:
 *   1. Click the official link → download happens on the government's
 *      own site (leaves our app — this is a hard requirement, see
 *      lib/official-textbook-links.ts for why).
 *   2. Come back and upload that PDF via "Teach from textbook" in the
 *      classroom — or, on a phone with AI Guru installed as a PWA,
 *      just use the Share button on the downloaded file and pick
 *      "AI Guru" to skip the manual upload step entirely.
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink, BookOpen, Share2, ArrowRight, Info, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { OFFICIAL_TEXTBOOK_PORTALS } from "@/lib/official-textbook-links";
import { studentSession } from "@/lib/student-session";

function OfficialTextbooksInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [studentBoard, setStudentBoard] = useState<string | null>(null);

  useEffect(() => {
    const profile = studentSession.get();
    setStudentBoard(profile?.syllabus || params.get("board") || null);
  }, [params]);

  const sorted = [...OFFICIAL_TEXTBOOK_PORTALS].sort((a, b) => {
    if (a.boardId === studentBoard) return -1;
    if (b.boardId === studentBoard) return 1;
    return 0;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Study Materials"
        title="Official textbooks"
        subtitle="Download the real textbook from your board's own government website — then bring it into AI Guru."
      />

      <Card className="mb-5 flex gap-3">
        <Info size={16} className="text-marigold shrink-0 mt-0.5" />
        <div className="text-xs text-chalkdim leading-relaxed">
          <b className="text-chalk">How this works:</b> tap your board below → you'll go to their
          official site to download the PDF (this is required — AI Guru never hosts these
          files itself, only links to them). Once downloaded, come back here and use
          <b className="text-chalk"> "Teach from textbook"</b> in the classroom to upload it.
          {" "}On Android, you can also use your phone's <b className="text-chalk">Share</b> button
          on the downloaded PDF and pick <b className="text-chalk">AI Guru</b> to skip the
          upload step.
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {sorted.map(portal => (
          <Card key={portal.boardId} className={portal.boardId === studentBoard ? "border-marigold/60" : ""}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BookOpen size={15} className="text-marigold shrink-0" />
                  <div className="text-sm font-medium text-chalk">{portal.boardLabel}</div>
                  {portal.boardId === studentBoard && (
                    <span className="font-mono text-[9px] text-marigold border border-marigold/40 rounded-full px-2 py-0.5">
                      YOUR BOARD
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-chalkdim">{portal.portalName}</div>
                <div className="mt-1.5 text-xs text-chalkdim leading-relaxed">{portal.howTo}</div>
              </div>
            </div>
            <a href={portal.url} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-marigold px-3.5 py-2 text-xs font-semibold text-board hover:bg-marigolddim transition-colors">
              <ExternalLink size={12} /> Open official site
            </a>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <button onClick={() => router.push("/classroom")}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-board3 bg-board2 px-4 py-3 text-sm text-chalkdim hover:text-chalk hover:border-marigold/50 transition-colors">
          <ArrowRight size={14} /> Already downloaded a PDF? Go upload it in the classroom
        </button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-board3 bg-board2 px-3.5 py-3 text-xs text-chalkdim">
        <Share2 size={13} className="text-marigold shrink-0 mt-0.5" />
        Installed AI Guru to your home screen? After downloading a PDF, tap Android's Share
        button on it and choose AI Guru — it'll open straight into "Teach from textbook", no
        need to browse for the file.
      </div>

      {/* Fallback for boards not covered above, or a link that stopped working */}
      <Card className="mt-4">
        <div className="flex items-start gap-2.5">
          <Search size={15} className="text-marigold shrink-0 mt-0.5" />
          <div className="text-xs text-chalkdim leading-relaxed">
            <b className="text-chalk">Don't see your board, or a link not working?</b> Only a few
            boards are listed above for now. Most Indian states publish their textbooks free
            online — try searching{" "}
            <a
              href="https://www.google.com/search?q=state+board+textbook+pdf+official+download"
              target="_blank" rel="noopener noreferrer"
              className="text-marigold underline"
            >
              "[your state] state board textbook pdf official"
            </a>{" "}
            on Google. Look for a <b className="text-chalk">.gov.in</b> or <b className="text-chalk">.nic.in</b> website
            specifically — that's how you know it's the real official source, not a random
            re-upload. Once downloaded, come back here and upload it the same way.
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function OfficialTextbooksPage() {
  return <Suspense fallback={null}><OfficialTextbooksInner /></Suspense>;
}
