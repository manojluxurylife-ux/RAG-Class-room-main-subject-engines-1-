/**
 * Students store — the server-side registry of every student who has
 * signed up. Backed by Upstash Redis in production (falls back to a
 * local JSON file for zero-setup `next dev`) — see
 * lib/firestore-collection.ts and lib/upstash-store.ts. Despite the
 * "firestore-collection" filename (a leftover from an earlier plan that
 * was never actually built), no Firestore integration exists here.
 *
 * WHY THIS EXISTS: student profiles previously lived only in each
 * browser's localStorage (lib/student-session.ts) — the admin had no way
 * to see who had signed up at all. /api/auth/signup/student writes here
 * in addition to the browser session, so the admin dashboard can show
 * real subscriber counts, search students, and view individual activity.
 */
import { collectionHelpers } from "./firestore-collection";

export interface StudentRecord {
  id:           string;
  name:         string;
  email:        string;
  phone:        string;
  className:    string;   // "V".."XII"
  grade:        string;   // numeric, derived from className
  syllabus:     string;   // "cbse" | "kerala" | "tamilnadu" | "karnataka"
  schoolName:   string;
  country:      string;
  state:        string;
  district:     string;
  place:        string;
  languageId:   string;
  signedUpAt:   string;   // ISO date
  lastActiveAt: string;   // ISO date, updated on login
  passwordHash: string;   // never returned to the client
}

const CLASS_TO_GRADE: Record<string, string> = {
  V:"5", VI:"6", VII:"7", VIII:"8", IX:"9", X:"10", XI:"11", XII:"12",
};

const col = collectionHelpers<StudentRecord>("students");

export const studentsStore = {
  all: col.all,
  byId: col.byId,

  async byEmail(email: string): Promise<StudentRecord | null> {
    const matches = await col.where("email", email.toLowerCase());
    return matches[0] || null;
  },

  // Safe view for API responses / admin UI — strips the password hash.
  async allPublic(): Promise<Omit<StudentRecord, "passwordHash">[]> {
    const students = await col.all();
    return students.map(({ passwordHash, ...rest }) => rest);
  },

  async create(data: Omit<StudentRecord, "id" | "grade" | "signedUpAt" | "lastActiveAt">): Promise<StudentRecord> {
    const existing = await studentsStore.byEmail(data.email);
    if (existing) throw new Error("An account with this email already exists.");

    const now = new Date().toISOString();
    return col.create({
      ...data,
      email: data.email.toLowerCase(),
      grade: CLASS_TO_GRADE[data.className] || data.className,
      signedUpAt: now,
      lastActiveAt: now,
    });
  },

  async touchLastActive(id: string) {
    await col.update(id, { lastActiveAt: new Date().toISOString() });
  },

  // ── Aggregate stats for the admin dashboard ──
  async stats() {
    const students = await col.all();
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const activeLast7d = students.filter(s => now - new Date(s.lastActiveAt).getTime() < 7 * DAY).length;
    const newLast7d    = students.filter(s => now - new Date(s.signedUpAt).getTime()  < 7 * DAY).length;
    const newLast30d   = students.filter(s => now - new Date(s.signedUpAt).getTime()  < 30 * DAY).length;

    const bySyllabus: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    const byGrade:    Record<string, number> = {};
    const byState:    Record<string, number> = {};

    for (const s of students) {
      bySyllabus[s.syllabus]         = (bySyllabus[s.syllabus] || 0) + 1;
      byLanguage[s.languageId]       = (byLanguage[s.languageId] || 0) + 1;
      byGrade[s.grade]               = (byGrade[s.grade] || 0) + 1;
      byState[s.state || "Unknown"]  = (byState[s.state || "Unknown"] || 0) + 1;
    }

    return { total: students.length, activeLast7d, newLast7d, newLast30d, bySyllabus, byLanguage, byGrade, byState };
  },

  // Daily signup counts for the last N days — feeds the dashboard line chart.
  async signupsByDay(days = 30): Promise<{ date: string; count: number }[]> {
    const students = await col.all();
    const buckets: Record<string, number> = {};
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    for (const s of students) {
      const day = s.signedUpAt.slice(0, 10);
      if (day in buckets) buckets[day]++;
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
  },
};
