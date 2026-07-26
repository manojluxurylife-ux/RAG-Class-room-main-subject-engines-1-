"use client";
/**
 * GlobalDoubtDock — mounts the floating camera/mic pane ONCE in the
 * student layout so the pill dock is visible on EVERY student page,
 * exactly how the reference app (Nexus Justice) renders its
 * "GLOBAL HARDWARE DOCK" at the app root instead of per-page.
 *
 * Reads the student profile client-side (studentSession uses
 * localStorage), so this must render after mount — the `ready` gate
 * avoids an SSR/hydration mismatch in Next.js. If no student is logged
 * in, nothing renders (the dock is a student feature, matching how the
 * reference gates its dock to the Advocate Portal only).
 */
import { useEffect, useState } from "react";
import { studentSession, type StudentProfile } from "@/lib/student-session";
import { restoreStudentSession } from "@/lib/client/restore-student-session";
import { textbookContext, type TextbookContext } from "@/lib/textbook-context";
import { pendingDoubt } from "@/lib/pending-doubt";
import { DoubtCameraMic } from "@/components/DoubtCameraMic";

export function GlobalDoubtDock() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [ready, setReady] = useState(false);
  // Which textbook/topic the student was last working with in RAG
  // Classroom or Material Studio — see lib/textbook-context.ts. Read on
  // mount and kept live via subscribe(), so switching documents there
  // updates the doubt dock's grounding without needing a page reload.
  const [activeTextbook, setActiveTextbook] = useState<TextbookContext | null>(null);
  // A highlighted excerpt the student asked about elsewhere on the page
  // (see lib/pending-doubt.ts) — formatted here, not left to the caller,
  // so every "ask about this" request produces a distinct string even if
  // the same excerpt is highlighted twice in a row.
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  useEffect(() => {
    // Was studentSession.get() (localStorage only) — meant a lost local
    // profile made this dock silently vanish on EVERY page, with no
    // error and no recovery, even though the student was still validly
    // signed in via the long-lived server cookie. Self-heals the same
    // way rag-classroom/homework/etc. already do.
    restoreStudentSession().then(setProfile).finally(() => setReady(true));
    setActiveTextbook(textbookContext.get());
    const unsubTextbook = textbookContext.subscribe(setActiveTextbook);
    const unsubDoubt = pendingDoubt.subscribe((d) =>
      setPendingQuestion(`Can you explain this: "${d.excerpt}"`)
    );
    const refreshProfile = () => setProfile(studentSession.get());
    window.addEventListener("student-session-changed", refreshProfile);
    return () => { unsubTextbook(); unsubDoubt(); window.removeEventListener("student-session-changed", refreshProfile); };
  }, []);

  if (!ready || !profile) return null;

  return (
    <DoubtCameraMic
      grade={profile.grade}
      boardId={profile.syllabus}
      languageId={profile.teachingLanguage || profile.languageId || "english"}
      teachingStyle={profile.teachingStyle || "target_with_english_terms"}
      textbookContext={activeTextbook}
      pendingQuestion={pendingQuestion}
    />
  );
}
