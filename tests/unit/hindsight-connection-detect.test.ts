/**
 * "Hindsight is not running" must not read as "Hindsight is broken".
 *
 * The route maps this predicate to 503 vs 500, so a false answer shows a user
 * who simply has not started Hindsight a server error instead of an empty
 * state. Node's fetch throws `TypeError: fetch failed` and hides the real
 * reason in `cause`, which the original message-only check missed, so the
 * commonest case of all was landing on 500.
 */
import { isHindsightConnectionError } from "@/lib/memory/hindsight-request";

const withCause = (msg: string, cause: unknown) => Object.assign(new Error(msg), { cause });

describe("isHindsightConnectionError", () => {
  it("sees through Node fetch's wrapper to the real cause", () => {
    // Exactly the shape undici produces when nothing is listening.
    const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9177"), { code: "ECONNREFUSED" });
    expect(isHindsightConnectionError(withCause("fetch failed", cause))).toBe(true);
  });

  it("treats a bare 'fetch failed' as a connection problem", () => {
    // Some runtimes give no cause at all; a failed fetch to a local service is
    // still far more likely to be "not running" than "broken".
    expect(isHindsightConnectionError(new TypeError("fetch failed"))).toBe(true);
  });

  it("still catches the plainly-worded cases it always caught", () => {
    for (const m of ["connect ECONNREFUSED", "connection refused", "request timed out"]) {
      expect(isHindsightConnectionError(new Error(m))).toBe(true);
    }
  });

  it("recognises an errno code even when the message says nothing useful", () => {
    expect(isHindsightConnectionError(Object.assign(new Error("boom"), { code: "ETIMEDOUT" }))).toBe(true);
  });

  it("does NOT claim a real application error is a connection problem", () => {
    // This is the half that matters: over-matching would hide genuine faults
    // behind a friendly "service is down" and nobody would investigate.
    expect(isHindsightConnectionError(new Error("bank 'hermes' does not exist"))).toBe(false);
    expect(isHindsightConnectionError(new Error("invalid JSON in response"))).toBe(false);
    expect(isHindsightConnectionError(new Error("500 Internal Server Error"))).toBe(false);
  });

  it("does not explode on a non-Error, or on a cause cycle", () => {
    expect(isHindsightConnectionError("fetch failed")).toBe(false);
    expect(isHindsightConnectionError(null)).toBe(false);
    const a = new Error("a"); Object.assign(a, { cause: a });   // self-referential
    expect(isHindsightConnectionError(a)).toBe(false);
  });
});
