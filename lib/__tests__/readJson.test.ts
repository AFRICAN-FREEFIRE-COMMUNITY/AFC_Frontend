/**
 * lib/__tests__/readJson.test.ts
 * ──────────────────────────────
 * Unit tests for lib/readJson.ts.
 *
 * Run with:  node --test lib/__tests__/readJson.test.ts
 * (Node strips the TypeScript types natively, so no build step and no test runner is needed -
 * the same arrangement as lib/__tests__/newBadge.test.ts. The module under test deliberately
 * imports nothing, so it loads here cleanly.)
 *
 * WHAT THIS IS PROTECTING. Admin screens read a response body BEFORE checking res.ok, because a
 * handled error carries a `message` written for a person and that is what should be shown. The
 * pattern only breaks when the body is not JSON, which is exactly when something has really gone
 * wrong, and then `res.json()` throws before the !ok branch is reached. A real 500 on the
 * leaderboard editor surfaced to an admin as:
 *
 *     Unexpected token '<', "<!DOCTYPE "... is not valid JSON     [Retry]
 *
 * The cause was a database column a pending migration had not created. Nothing on screen could
 * have led anyone there.
 *
 * So the two behaviours that must both hold, and pull in opposite directions:
 *   1. a JSON body is returned untouched, so every existing `data.message` keeps working;
 *   2. a NON-JSON body still yields an object with a `message`, so the same line starts saying
 *      something true instead of throwing.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { readJson, isNonJson } from "../readJson.ts";

/** Minimal stand-in for a fetch Response: readJson only uses .text(), .ok and .status. */
function res(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

test("a JSON body is returned as-is, so existing callers are untouched", async () => {
  const data: any = await readJson(res(JSON.stringify({ event_id: 223, message: "hi" })));
  assert.equal(data.event_id, 223);
  assert.equal(data.message, "hi");
  assert.equal(isNonJson(data), false);
});

test("a handled JSON error keeps its own message, which is the whole point of reading first", async () => {
  const data: any = await readJson(res(JSON.stringify({ message: "That team is already registered." }), 400));
  assert.equal(data.message, "That team is already registered.");
  assert.equal(isNonJson(data), false);
});

test("an HTML 500 page becomes a sentence instead of a parser complaint", async () => {
  const data: any = await readJson(res("<!DOCTYPE html><html><body>Server Error</body></html>", 500));

  assert.equal(isNonJson(data), true);
  assert.match(data.message, /server hit an error \(500\)/i);
  // The admin must not be shown fragments of a debug page.
  assert.ok(!data.message.includes("<"), "the HTML body must not be pasted into the message");
  // `data.detail` is read as a fallback by several call sites, so it must be populated too.
  assert.equal(data.detail, data.message);
});

test("it never throws, which is the property the old code lacked", async () => {
  for (const [body, status] of [["<html>", 502], ["not json", 500], ["", 504], ["{oops", 200]] as const) {
    await assert.doesNotReject(() => readJson(res(body, status)));
  }
});

test("404 says the address does not exist, not that the server broke", async () => {
  const data: any = await readJson(res("<!DOCTYPE html>", 404));
  assert.match(data.message, /does not exist/i);
});

test("401 and 403 mention permission or an expired session", async () => {
  for (const status of [401, 403]) {
    const data: any = await readJson(res("<!DOCTYPE html>", status));
    assert.match(data.message, /not allowed|expired/i);
  }
});

test("an empty OK body is an empty object, not an error", async () => {
  const data: any = await readJson(res("", 204));
  assert.equal(isNonJson(data), false);
  assert.deepEqual(data, {});
});

test("an empty FAILED body still explains itself", async () => {
  const data: any = await readJson(res("", 500));
  assert.equal(isNonJson(data), true);
  assert.match(data.message, /500/);
});

test("a short plain-text reason from a proxy is shown verbatim, since it is the only clue", async () => {
  const data: any = await readJson(res("upstream timed out", 504));
  assert.match(data.message, /upstream timed out/);
});

test("a long non-JSON body is NOT pasted into the message", async () => {
  const data: any = await readJson(res("x".repeat(500), 500));
  assert.ok(data.message.length < 250, "the message must stay readable");
  assert.ok(!data.message.includes("xxxxxxxxxxxxxxxxxxxx"));
});
