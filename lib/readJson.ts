// lib/readJson.ts
//
// Read a fetch Response body as JSON WITHOUT turning a non-JSON error page into a parser message.
//
// WHY THIS EXISTS (owner report 2026-08-22)
// ---------------------------------------------------------------------------
// Admin screens across this app do:
//
//     const data = await res.json();
//     if (!res.ok) throw new Error(data.message || data.detail || "Failed to fetch data");
//
// That is deliberate, not sloppy: the backend returns a JSON body with a `message` on a HANDLED
// error, and reading it first is how the screen shows a sentence written for a person.
//
// It only breaks when the response is NOT JSON, and that is exactly when something has gone
// properly wrong: a Django 500 debug page, an nginx 502, a proxy timeout, an HTML login redirect.
// `res.json()` then THROWS before the `!res.ok` branch is ever reached, so the admin is shown the
// parser's complaint instead of the problem. The real report that prompted this, on the leaderboard
// editor, was:
//
//     Unexpected token '<', "<!DOCTYPE "... is not valid JSON     [Retry]
//
// The actual cause was a 500 from a database column that a pending migration had not created yet.
// Nothing on screen could have led anyone to that, and "Retry" was never going to help.
//
// WHAT THIS DOES
// ---------------------------------------------------------------------------
// Returns the parsed body when the body is JSON. When it is not, returns a stand-in object carrying
// a `message` describing what actually happened, so every existing `data.message || ...` line keeps
// working unchanged and starts saying something true. It never throws.
//
// The status is what the sentence is built from, because it is the one piece of information that is
// reliably present and reliably meaningful. A snippet of the body is appended only when it is short
// and not HTML, since pasting a fragment of a debug page at an admin helps nobody.
//
// USED BY: the admin leaderboard editor, the leaderboard step components, the Results Import tab,
// the admin team detail screen, and the organizer leaderboard page - every place that had the
// pattern above.

/** A body that was not JSON, shaped so existing `data.message` / `data.detail` reads still work. */
export type NonJsonBody = { message: string; detail: string; _nonJson: true; _status: number };

function sentenceFor(status: number, raw: string): string {
  const looksHtml = /^\s*<(!doctype|html|head|body)/i.test(raw);
  // A short, non-HTML body is often a plain-text reason from a proxy and worth showing verbatim.
  const tail = !looksHtml && raw.trim() && raw.trim().length <= 120 ? ` ${raw.trim()}` : "";

  if (status === 0) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (status >= 500) {
    return (
      `The server hit an error (${status}) and did not return a readable answer.` +
      ` This is not something you did wrong; it needs a look at the server logs.${tail}`
    );
  }
  if (status === 404) {
    return `That address does not exist on the server (404).${tail}`;
  }
  if (status === 401 || status === 403) {
    return `You are not allowed to do that (${status}), or your session has expired.${tail}`;
  }
  if (status === 413) {
    return "That file is too large for the server to accept (413).";
  }
  return `The server returned an unexpected response (${status}).${tail}`;
}

/**
 * Parse `res` as JSON, or return a `{ message, detail }` stand-in explaining the real failure.
 *
 * Callers keep their existing shape:
 *
 *     const data = await readJson(res);
 *     if (!res.ok) throw new Error(data.message || data.detail || "Failed to fetch data");
 */
export async function readJson<T = any>(res: Response): Promise<T | NonJsonBody> {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    // The body could not even be read (aborted, network dropped mid-response).
    const message = sentenceFor(res.status || 0, "");
    return { message, detail: message, _nonJson: true, _status: res.status || 0 };
  }

  // A 204, or any genuinely empty body, is not an error by itself: an ok response with nothing in
  // it becomes {} so callers reading optional fields behave as they always did.
  if (!raw.trim()) {
    if (res.ok) return {} as T;
    const message = sentenceFor(res.status, "");
    return { message, detail: message, _nonJson: true, _status: res.status };
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    const message = sentenceFor(res.status, raw);
    return { message, detail: message, _nonJson: true, _status: res.status };
  }
}

/** True when `readJson` had to stand in for a body that was not JSON. */
export function isNonJson(body: unknown): body is NonJsonBody {
  return Boolean(body && typeof body === "object" && (body as NonJsonBody)._nonJson);
}
