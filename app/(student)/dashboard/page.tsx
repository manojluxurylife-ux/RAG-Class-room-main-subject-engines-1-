"use client";
/**
 * Student Dashboard — now a colourful "what to do / how to do it"
 * getting-started guide for students new to the app, replacing the
 * blank placeholder from the previous session.
 *
 * The full welcome/stats/quick-start experience for RETURNING students
 * lives on Settings (see app/(student)/settings/page.tsx) — this page
 * is specifically the onboarding guide for someone who hasn't used the
 * app yet, since that's the more useful thing for a first landing page
 * to be than either a blank screen or a duplicate of Settings.
 */
import { PageHeader } from "@/components/ui";
import { GettingStartedGuide } from "@/components/GettingStartedGuide";

export default function StudentDashboard() {
  return (
    <div>
      <PageHeader
        eyebrow="New here?"
        title="Getting started with AI Guru"
        subtitle="Five things to know — tap any one to see exactly how."
      />
      <GettingStartedGuide />
    </div>
  );
}
