/**
 * AI feature switches.
 * Server-managed Gemini/ADK is intentionally disabled by default.
 * To reactivate later, set BOTH variables to "true" in the deployment.
 */
export const SERVER_AI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SERVER_AI === "true";

export function serverAiEnabledOnServer(): boolean {
  return process.env.ENABLE_SERVER_AI === "true" && process.env.NEXT_PUBLIC_ENABLE_SERVER_AI === "true";
}
