/**
 * Messages store — live chat between admin and students, not a ticket
 * list. One thread per student conversation. An AI bot auto-responds to
 * new messages until an admin actually replies — once a human has
 * spoken in a thread, the bot goes quiet for that thread (matches how
 * real support chat products like Intercom hand off from bot to agent),
 * so it never talks over an admin who's already handling it.
 */
import { collectionHelpers } from "./firestore-collection";
import { nanoid } from "nanoid";

export type ThreadStatus = "open" | "resolved";
export type MessageSender = "student" | "admin" | "bot";

export interface ThreadMessage {
  id:             string;
  from:           MessageSender;
  text:           string;
  sentAt:         string;   // ISO date
  // The GCS object name (permanent) — never a signed URL, which expires
  // after 1 hour. A signed URL for display is generated fresh on every
  // fetch (see the messages API routes) so an attachment a student sent
  // is still viewable by an admin checking days later, not just within
  // the first hour.
  attachmentRef?: string;
  attachmentName?:string;
  attachmentType?:string;   // mime type — used to decide image-preview vs generic file icon
}

export interface MessageThread {
  id:            string;
  studentId:     string;
  studentName:   string;
  studentEmail:  string;
  subject:       string;
  status:        ThreadStatus;
  messages:      ThreadMessage[];
  adminHasReplied: boolean;   // once true, the bot stops auto-responding in this thread
  createdAt:     string;
  updatedAt:     string;
}

const col = collectionHelpers<MessageThread>("message_threads");

export interface HydratedThreadMessage extends ThreadMessage {
  attachmentUrl?: string; // freshly signed, added only when returning to a client — never persisted
}
export interface HydratedThread extends Omit<MessageThread, "messages"> {
  messages: HydratedThreadMessage[];
}

export const messagesStore = {
  all: col.all,
  byId: col.byId,

  /**
   * Generates fresh signed URLs for every attachment in a thread — called
   * right before returning thread data to a client. Never persisted;
   * signed URLs expire in an hour, so this has to happen on every fetch,
   * not once at upload time.
   */
  async hydrateAttachments(thread: MessageThread): Promise<HydratedThread> {
    const { signedDownloadUrl } = await import("./storage/gcs");
    const messages: HydratedThreadMessage[] = await Promise.all(thread.messages.map(async (m) => {
      if (!m.attachmentRef) return m;
      try {
        const attachmentUrl = await signedDownloadUrl(m.attachmentRef);
        return { ...m, attachmentUrl };
      } catch {
        return m; // GCS not configured or object missing — message still shows, just without the attachment preview
      }
    }));
    return { ...thread, messages };
  },

  async byStudent(studentId: string): Promise<MessageThread[]> {
    return col.where("studentId", studentId);
  },

  async startThread(data: {
    studentId: string; studentName: string; studentEmail: string;
    subject: string; text: string;
    attachmentRef?: string; attachmentName?: string; attachmentType?: string;
  }): Promise<MessageThread> {
    const now = new Date().toISOString();
    const firstMessage: ThreadMessage = {
      id: nanoid(8), from: "student", text: data.text, sentAt: now,
      attachmentRef: data.attachmentRef, attachmentName: data.attachmentName, attachmentType: data.attachmentType,
    };
    return col.create({
      studentId: data.studentId,
      studentName: data.studentName,
      studentEmail: data.studentEmail,
      subject: data.subject,
      status: "open",
      messages: [firstMessage],
      adminHasReplied: false,
      createdAt: now,
      updatedAt: now,
    });
  },

  /** A thread the SYSTEM starts (renew reminders, notices) — first
   *  message is from "bot", unlike startThread which is student-first. */
  async systemNotice(data: { studentId: string; studentName: string; studentEmail: string; subject: string; text: string }): Promise<MessageThread> {
    const now = new Date().toISOString();
    return col.create({
      studentId: data.studentId,
      studentName: data.studentName,
      studentEmail: data.studentEmail,
      subject: data.subject,
      status: "open",
      messages: [{ id: nanoid(8), from: "bot", text: data.text, sentAt: now }],
      adminHasReplied: false,
      createdAt: now,
      updatedAt: now,
    });
  },

  async reply(
    threadId: string, from: MessageSender, text: string,
    attachment?: { ref: string; name: string; type: string },
  ): Promise<MessageThread | null> {
    const thread = await col.byId(threadId);
    if (!thread) return null;
    const now = new Date().toISOString();
    const message: ThreadMessage = {
      id: nanoid(8), from, text, sentAt: now,
      attachmentRef: attachment?.ref, attachmentName: attachment?.name, attachmentType: attachment?.type,
    };
    return col.update(threadId, {
      messages: [...thread.messages, message],
      updatedAt: now,
      status: from === "admin" ? thread.status : "open",   // student reply reopens
      adminHasReplied: thread.adminHasReplied || from === "admin",
    });
  },

  async setStatus(threadId: string, status: ThreadStatus) {
    return col.update(threadId, { status, updatedAt: new Date().toISOString() });
  },

  async stats() {
    const threads = await col.all();
    return {
      total: threads.length,
      open: threads.filter(t => t.status === "open").length,
      resolved: threads.filter(t => t.status === "resolved").length,
    };
  },
};
