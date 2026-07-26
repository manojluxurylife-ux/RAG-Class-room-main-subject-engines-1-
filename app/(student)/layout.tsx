import Link from "next/link";
import { ReactNode } from "react";
import { SubscriptionNotice } from "@/components/SubscriptionGate";
import { DevBypassBanner } from "@/components/DevBypassBanner";
import { PortalSwitcher } from "@/components/PortalSwitcher";
import { GlobalDoubtDock } from "@/components/GlobalDoubtDock";
import { StudentMainNav } from "@/components/StudentMainNav";

// No PortalShell here on purpose — students authenticate via /login
// (student mode) rather than the admin/parent/school portal pattern in
// components/PortalShell.tsx — this layout is its own lightweight nav.
export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DevBypassBanner />
      <PortalSwitcher />
      {/* MAIN MENU — sticky, always visible at the top of EVERY student
          page (Classroom, Study Materials, Homework, …), so navigation
          never scrolls away mid-lesson. bg matches the board colour with
          slight translucency + blur so content sliding underneath stays
          legible without the bar looking like a separate app. */}
      <div className="sticky top-0 z-40 border-b border-board3 bg-board/95 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 pt-3 pb-2">
          <div className="mb-2 flex items-center justify-between">
            <Link href="/" className="font-display text-xl text-chalk">
              AI Guru Final Layout
            </Link>
          </div>
          <StudentMainNav />

        </div>
      </div>
      <div className="mx-auto max-w-[1600px] px-4 py-6">
      <SubscriptionNotice />
      {children}
      </div>
      {/* Floating camera/mic pane — visible on EVERY student page, exactly
          like the reference app's global hardware dock. */}
      <GlobalDoubtDock />
    </>
  );
}
