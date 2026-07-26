/**
 * Parent-child links — a parent account can link to one or more real
 * student accounts by the child's own login email. This is the piece
 * that was completely missing before: nothing connected a parent to any
 * real student data at all.
 *
 * Deliberately simple for v1: linking just requires knowing the child's
 * account email (reasonable — a parent typically set up or knows their
 * own child's login). A stronger verification/consent flow (e.g. an
 * approval step the child has to confirm, or formal DPDP Act parental-
 * consent tracking) is real, separate compliance work not built here —
 * flagged clearly rather than silently assumed solved.
 */
import { collectionHelpers } from "./firestore-collection";

export interface ParentLink {
  id:            string;
  parentId:      string;
  studentId:     string;
  studentEmail:  string;
  studentName:   string;
  linkedAt:      string;
}

const col = collectionHelpers<ParentLink>("parent_links");

export const parentLinksStore = {
  async byParent(parentId: string): Promise<ParentLink[]> {
    return col.where("parentId", parentId);
  },

  async linkExists(parentId: string, studentId: string): Promise<boolean> {
    const links = await parentLinksStore.byParent(parentId);
    return links.some(l => l.studentId === studentId);
  },

  /** Returns the link if it belongs to this parent — used to guard every
   *  child-data route so a parent can only ever see their own linked
   *  children's analytics, never an arbitrary studentId. */
  async findLinkForParent(parentId: string, studentId: string): Promise<ParentLink | null> {
    const links = await parentLinksStore.byParent(parentId);
    return links.find(l => l.studentId === studentId) || null;
  },

  async create(data: Omit<ParentLink, "id" | "linkedAt">): Promise<ParentLink> {
    return col.create({ ...data, linkedAt: new Date().toISOString() });
  },

  async remove(id: string) {
    return col.remove(id);
  },
};
