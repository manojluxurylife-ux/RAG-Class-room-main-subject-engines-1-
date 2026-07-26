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
      {/* pb-40 (not the original py-6's plain bottom padding) —
          GlobalDoubtDock below is `position: fixed` near the bottom of
          the viewport with a solid background and z-[1000], so on any
          page with enough content to actually reach the bottom of the
          screen, the last bit of that content was rendering directly
          underneath it — visually hidden, easy to mistake for having
          disappeared entirely (this is what was happening to Material
          Studio's amber "Create all materials again" button and the
          material cards near it). This clears space for the dock on
          every student page instead of patching each one individually. */}
      <div className="mx-auto max-w-[1600px] px-4 pt-6 pb-40">
      <SubscriptionNotice />
      {children}
      </div>
      {/* Floating camera/mic pane — visible on EVERY student page, exactly
          like the reference app's global hardware dock. */}
      <GlobalDoubtDock />
    </>
  );
}
