import { NextResponse } from "next/server";

/**
 * Wraps a Firestore-touching route handler so a database/config problem
 * produces one clear, actionable error everywhere, instead of either an
 * unhandled 500 crash or a leaked raw gRPC error like "5 NOT_FOUND: ..."
 * shown directly to a student on screen.
 *
 * FIXED a real gap found from a live failure report: this used to only
 * show the helpful message when the error text contained "NOT_FOUND",
 * "Firestore", or "PERMISSION_DENIED" — anything else fell through to a
 * vague "Something went wrong. Please try again." A malformed
 * database configuration (a very easy real mistake — e.g. pasting a multi-line
 * JSON into a single-line env var field) throws a plain
 * JSON.parse SyntaxError, which contains none of those keywords, so it
 * hit the unhelpful fallback — exactly what happened on a live deploy.
 *
 * Fixed by inverting the logic: every route using this wrapper only ever
 * does Firestore/GCS work in its try block, and the ONLY genuinely
 * "normal" errors (duplicate email, validation) are handled with their
 * own early returns BEFORE reaching this catch-all. So anything that
 * lands here, by construction, is an unexpected server-side problem —
 * the fallback message itself now says so and points at configuration,
 * rather than trying to keyword-match every possible error format.
 */
export async function withApiErrorHandling(
  routeName: string,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (e: any) {
    // requireStudent()/requireRole() (lib/auth.ts) deliberately tag
    // access-control rejections with a real status code — e.g. 401 for
    // "not signed in". Those are expected, meaningful outcomes, not the
    // unexpected server-side crashes this wrapper exists to mask; sending
    // them through as a generic 500 "configuration problem" is actively
    // misleading (a logged-out student sees a scary server-error message
    // instead of a clean "please log in") and breaks any client-side
    // logic that branches on a 401 to redirect to the login page.
    if (typeof e?.status === "number" && e.status >= 400 && e.status < 500) {
      return NextResponse.json({ error: e.message || "Request not permitted." }, { status: e.status });
    }

    // Full detail always goes to the server log (your deployment platform's
    // logs) — this is the ONLY place the exact cause is visible; the client 
    // response is deliberately generic-but-actionable, never the raw error text.
    const errorMessage = typeof e?.message === "string" ? e.message : (typeof e === "string" ? e : "An unexpected error occurred.");
    console.error(`[${routeName}]`, errorMessage);
    
    let userFriendlyError = "The server hit a configuration problem — this isn't something you did wrong. " +
          "(Admin: check your deployment platform's logs for this request for the exact cause.)";
          
    if (errorMessage.includes("Missing UPSTASH_REDIS_REST_URL") || errorMessage.includes("Missing UPSTASH_REDIS_REST_TOKEN")) {
      userFriendlyError = "Database configuration error: Database environment variables are missing. Please set these variables.";
    }

    return NextResponse.json(
      {
        error: userFriendlyError,
      },
      { status: 500 },
    );
  }
}
