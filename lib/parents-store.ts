/**
 * Parents store — the server-side registry of parent accounts. Same
 * pattern as students-store.ts, backed by Firestore.
 *
 * This didn't exist before — /parent/* pages showed a hardcoded "Anjali"
 * demo child with a TODO comment, and the login route only handled
 * "admin"/"student" modes. There was no way for a parent to actually
 * sign up, log in, or link to their real child's account at all.
 */
import { collectionHelpers } from "./firestore-collection";

export interface ParentRecord {
  id:           string;
  name:         string;
  email:        string;
  phone:        string;
  signedUpAt:   string;
  lastActiveAt: string;
  passwordHash: string;   // never returned to the client
}

const col = collectionHelpers<ParentRecord>("parents");

export const parentsStore = {
  all: col.all,
  byId: col.byId,

  async byEmail(email: string): Promise<ParentRecord | null> {
    const matches = await col.where("email", email.toLowerCase());
    return matches[0] || null;
  },

  async create(data: Omit<ParentRecord, "id" | "signedUpAt" | "lastActiveAt">): Promise<ParentRecord> {
    const existing = await parentsStore.byEmail(data.email);
    if (existing) throw new Error("An account with this email already exists.");
    const now = new Date().toISOString();
    return col.create({ ...data, email: data.email.toLowerCase(), signedUpAt: now, lastActiveAt: now });
  },

  async touchLastActive(id: string) {
    return col.update(id, { lastActiveAt: new Date().toISOString() });
  },
};
