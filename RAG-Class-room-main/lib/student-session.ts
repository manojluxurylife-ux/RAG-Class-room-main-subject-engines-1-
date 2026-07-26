/**
 * Client-side student session store.
 *
 * DEV STAGE: uses localStorage so the whole auth flow works end-to-end
 * in the browser without a database or server-side session. The interface
 * is intentionally narrow — when you wire a real backend (NextAuth, JWT
 * cookie, Prisma) you replace only this file and the callers don't change.
 *
 * PRODUCTION PATH:
 *  1. Replace save() with a POST to /api/auth/session that sets an
 *     httpOnly cookie containing a signed JWT or session ID.
 *  2. Replace get()  with a fetch to /api/auth/me (reads the cookie,
 *     returns the student record from DB).
 *  3. Replace clear() with POST /api/auth/logout (clears the cookie).
 *  Search codebase for `studentSession.` to find every call site.
 */

export interface StudentProfile {
  name:       string;
  email:      string;
  phone:      string;
  className:  string;   // Roman: "VI", "VIII", etc. — as entered at signup
  grade:      string;   // Numeric string: "6", "8" — for API calls
  syllabus:   string;   // "cbse" | "kerala" | "tamilnadu" | "karnataka"
  schoolName: string;
  state:      string;
  district:   string;
  place:      string;
  languageId: string;   // legacy/default teaching language
  sourceLanguage?: string;
  teachingLanguage?: string;
  materialLanguage?: string;
  teachingStyle?: "target_only" | "target_with_english_terms" | "simple_english";
  // Whether Study Materials segments require passing the quiz before
  // moving forward. Defaults to true (encourages real mastery), but
  // students can turn this off in Settings if their app pace has fallen
  // behind their actual school lessons — a mandatory gate would otherwise
  // stop them matching what's being taught in class right now, which is
  // a real product-adoption risk at launch, not just a preference.
  quizGatingEnabled?: boolean;
  // Which admin-published material subjects the student cares about —
  // matches the taxonomy admin content is actually tagged with (Maths,
  // Science, Social Studies, Language, General — see lib/materials-store.ts),
  // NOT Study Materials' own 6-subject list, which is a different system.
  // undefined/omitted means "all subjects" — opt-out, not opt-in, so a
  // student who's never touched this setting still sees everything
  // rather than silently seeing nothing.
  subjectPreferences?: string[];
  // When the student last visited /materials — used purely client-side
  // to compute "how many new things have been published since then" for
  // the notification badge. No server round-trip needed to update this.
  lastMaterialsCheckAt?: string;
  // Admin-published materials the student has chosen to remove from their
  // own view — this ONLY affects what this student sees; it never touches
  // the admin's actual published Firestore record, which stays visible to
  // every other matching student. Purely a personal "hide" list.
  hiddenMaterialIds?: string[];
}

export interface LessonRecord {
  id:        string;
  topic:     string;
  boardId:   string;
  grade:     string;
  completedAt: string;   // ISO date
}

const SESSION_KEY = "gg_student_profile";
const HISTORY_KEY = "gg_lesson_history";

import { safeStorage } from "./safe-storage";

// Roman numeral class → numeric grade string
const CLASS_TO_GRADE: Record<string, string> = {
  V:"5", VI:"6", VII:"7", VIII:"8", IX:"9", X:"10", XI:"11", XII:"12",
};

function gradeFromClass(cls: string): string {
  return CLASS_TO_GRADE[cls] || cls;
}

export const studentSession = {
  save(profile: Omit<StudentProfile, "grade" | "languageId"> & { languageId?: string }) {
    if (typeof window === "undefined") return;
    const full: StudentProfile = {
      ...profile,
      grade:      gradeFromClass(profile.className),
      languageId: profile.languageId || "english",
      sourceLanguage: profile.sourceLanguage || "english",
      teachingLanguage: profile.teachingLanguage || profile.languageId || "malayalam",
      materialLanguage: profile.materialLanguage || "english",
      teachingStyle: profile.teachingStyle || "target_with_english_terms",
    };
    safeStorage.set(SESSION_KEY, full);
    window.dispatchEvent(new CustomEvent("student-session-changed", { detail: full }));
  },

  get(): StudentProfile | null {
    return safeStorage.get(SESSION_KEY);
  },

  update(patch: Partial<StudentProfile>) {
    const current = studentSession.get();
    if (!current) return;
    const updated = { ...current, ...patch };
    if (patch.className && !patch.grade) updated.grade = gradeFromClass(patch.className);
    safeStorage.set(SESSION_KEY, updated);
    window.dispatchEvent(new CustomEvent("student-session-changed", { detail: updated }));
  },

  clear() {
    if (typeof window === "undefined") return;
    safeStorage.del(SESSION_KEY);
    safeStorage.del(HISTORY_KEY);
  },

  isLoggedIn(): boolean {
    return !!studentSession.get();
  },

  /** Defaults to true (gated) when unset — matches the pedagogically
   *  recommended default; students opt out explicitly, not in. */
  isQuizGatingEnabled(): boolean {
    const p = studentSession.get();
    return p?.quizGatingEnabled !== false;
  },

  // ── Hidden admin materials — personal "remove from my view" only ──
  hideMaterial(materialId: string) {
    const p = studentSession.get();
    if (!p) return;
    const current = p.hiddenMaterialIds || [];
    if (!current.includes(materialId)) {
      studentSession.update({ hiddenMaterialIds: [...current, materialId] });
    }
  },

  unhideMaterial(materialId: string) {
    const p = studentSession.get();
    if (!p) return;
    studentSession.update({ hiddenMaterialIds: (p.hiddenMaterialIds || []).filter(id => id !== materialId) });
  },

  isMaterialHidden(materialId: string): boolean {
    const p = studentSession.get();
    return !!p?.hiddenMaterialIds?.includes(materialId);
  },

  // ── Lesson history ──────────────────────────────────────────────────────
  addLesson(topic: string, boardId: string, grade: string) {
    if (typeof window === "undefined") return;
    const history = studentSession.getHistory();
    const record: LessonRecord = {
      id: Math.random().toString(36).slice(2, 10),
      topic, boardId, grade,
      completedAt: new Date().toISOString(),
    };
    // Keep the 50 most recent lessons, newest first
    const updated = [record, ...history].slice(0, 50);
    safeStorage.set(HISTORY_KEY, updated);
    return record;
  },

  getHistory(): LessonRecord[] {
    return safeStorage.get(HISTORY_KEY) || [];
  },

  streakDays(): number {
    const history = studentSession.getHistory();
    if (history.length === 0) return 0;
    const days = new Set(
      history.map(h => new Date(h.completedAt).toDateString()),
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (days.has(d.toDateString())) streak++;
      else if (i > 0) break;
    }
    return streak;
  },
};
