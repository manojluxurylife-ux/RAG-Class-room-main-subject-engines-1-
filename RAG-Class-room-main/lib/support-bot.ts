/**
 * The auto-responding support bot — attempts to help with a student's
 * message immediately (real chat feel, no waiting for an admin to be
 * online), and clearly hands off to a human when it can't. Never
 * pretends to be human, and never speaks in a thread once an admin has
 * actually replied (see messages-store.ts's adminHasReplied flag) — the
 * bot's job is to cover the gap before a human sees the message, not to
 * compete with one.
 *
 * Vision-capable: if the student attaches a screenshot, the bot can
 * actually look at it (reuses callGeminiWithImage, same pattern as
 * textbook-page reading elsewhere in the app) — genuinely useful for
 * "here's the error I'm seeing" style problems.
 */
import { callGemini, callGeminiWithImage } from "./teacher-prompts";

const SUPPORT_SYSTEM_PROMPT = `You are the support assistant for AI Guru, an AI maths teacher app for Indian school students.

A student has sent a message describing a problem or question — it could be about the app (login issues, a feature not working, a payment question) or about their studies (confused about a topic, needs a doubt cleared).

GROUNDING — Only answer confidently if you genuinely know the answer. For app/technical/billing issues you're not certain about, say so plainly and let the student know a real admin will follow up soon — never invent a solution or a policy you're not sure of.

Keep your reply short (2-5 sentences), warm, and direct — like a helpful support chat, not a formal email. If you can actually solve their problem (e.g. a common "how do I..." question, or a study doubt you can genuinely help with), just answer it. If it's something only a human admin could resolve (a billing dispute, a bug that needs investigation, anything account-specific), say clearly that you've flagged it for the team and they'll get back to you soon — don't pretend to resolve what you can't.

Never claim to be a human. If asked directly, say you're the automated first responder and a real person will follow up if needed.`;

export async function generateBotReply(
  studentMessage: string,
  attachment?: { base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp" },
): Promise<string> {
  if (attachment) {
    return callGeminiWithImage(
      SUPPORT_SYSTEM_PROMPT,
      `The student attached this screenshot along with their message: "${studentMessage}". Look at the screenshot to understand their problem, then reply.`,
      attachment.base64,
      attachment.mimeType,
    );
  }
  return callGemini(SUPPORT_SYSTEM_PROMPT, studentMessage);
}
