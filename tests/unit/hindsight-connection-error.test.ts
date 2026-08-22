/**
 * hindsight-connection-error — unit tests for the connection-error
 * heuristic extracted from /api/memory/hindsight/route.ts and now living
 * in src/lib/memory/hindsight-request.ts with the transport it describes.
 *
 * The heuristic is a substring match on `error.message` (the upstream
 * Hindsight bridge already formats errors with the status + body in
 * the message). Tests cover:
 *  - the 4 positive substrings ("connect", "ECONNREFUSED", "refused",
 *    "timed out")
 *  - the negative case (a regular thrown Error)
 *  - non-Error values (string, undefined, null) — all return false
 *  - substring-in-the-middle (e.g. an error message that says
 *    "fetch failed: ECONNREFUSED 127.0.0.1:9177") still matches
 *  - false-positive guard: a message that *contains* "refused" as
 *    part of a longer English word (e.g. "refused to start") DOES
 *    match — this is intentional, the upstream wording uses these
 *    tokens deliberately. Document the behaviour so a future reader
 *    doesn't tighten the match.
 */

import { isHindsightConnectionError } from "@/lib/memory/hindsight-request";

describe("isHindsightConnectionError", () => {
  it("returns true when the message includes 'connect'", () => {
    expect(
      isHindsightConnectionError(new Error("fetch failed: connect ECONNREFUSED")),
    ).toBe(true);
  });

  it("returns true when the message includes 'ECONNREFUSED'", () => {
    expect(
      isHindsightConnectionError(new Error("Hindsight POST /v1/foo: 500 ECONNREFUSED")),
    ).toBe(true);
  });

  it("returns true when the message includes 'refused' (lowercase)", () => {
    expect(
      isHindsightConnectionError(new Error("Connection refused by upstream")),
    ).toBe(true);
  });

  it("returns true when the message includes 'timed out'", () => {
    expect(isHindsightConnectionError(new Error("Request timed out after 30000ms"))).toBe(
      true,
    );
  });

  it("returns true for the Hindsight bridge's typed timeout error", () => {
    // requestWithTimeout() throws "Hindsight GET /health: 500 <text>" or
    // an AbortError-derived message — both are matched by the substrings.
    expect(
      isHindsightConnectionError(new Error("Hindsight GET /health: AbortError: timed out")),
    ).toBe(true);
  });

  it("returns false for an unrelated Error message", () => {
    expect(isHindsightConnectionError(new Error("Invalid JSON in response body"))).toBe(
      false,
    );
  });

  it("returns false when the message is empty", () => {
    expect(isHindsightConnectionError(new Error(""))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isHindsightConnectionError("connect")).toBe(false);
    expect(isHindsightConnectionError(undefined)).toBe(false);
    expect(isHindsightConnectionError(null)).toBe(false);
    expect(isHindsightConnectionError(42)).toBe(false);
    expect(isHindsightConnectionError({ message: "connect" })).toBe(false);
  });

  it("matches a substring in the middle of a longer message", () => {
    // The Hindsight bridge formats errors as
    // `Hindsight ${method} ${path}: ${status} ${text}`. The connection
    // markers are not always at the start of the string.
    expect(
      isHindsightConnectionError(
        new Error("Hindsight POST /v1/default/banks/hermes/memories: fetch failed: connect ECONNREFUSED 127.0.0.1:9177"),
      ),
    ).toBe(true);
  });

  it("returns true for 'refused' even when used in a longer English word (documented behaviour)", () => {
    // "refused" matches both "Connection refused" and "refused to start".
    // The Hindsight bridge only uses the connection-sense; this test
    // pins the substring-match behaviour so a future tightening
    // (e.g. requiring a word boundary) is a deliberate change.
    expect(
      isHindsightConnectionError(new Error("Upstream agent refused to start")),
    ).toBe(true);
  });
});
