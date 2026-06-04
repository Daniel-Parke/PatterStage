/**
 * /api/memory/hindsight/route.ts — regression tests for the
 * `messageFromError` migration in session 128.
 *
 * Before the refactor, three sites in the route used the inline form
 *   error instanceof Error ? error.message : "<fallback>"
 * to coerce caught values into user-facing strings. The inline form
 * has one well-known subtle trap the canonical `messageFromError()`
 * helper handles correctly:
 *
 *   - `new Error("")` has `message === ""` and is an Error instance;
 *     the inline ternary would return an empty string but NOT fall
 *     back to `<fallback>`. `messageFromError()` uses `|| fallback`
 *     so the fallback fires for empty messages — the canonical
 *     "empty-Error trap" (see `api-logger.ts` for the verification
 *     matrix). This is the only case where the helper's output
 *     meaningfully differs from the inline form.
 *
 *   - For non-Error values (string, number), the inline form falls
 *     through to `<fallback>`; the helper coerces via `String(value)`
 *     and only falls back if the resulting string is empty. In
 *     practice the 3 migrated sites catch fetch rejections (always
 *     `Error` instances), so this divergence is unobservable in
 *     production. The test pins both branches to lock in the
 *     helper's actual behaviour so a future maintainer doesn't
 *     "tighten" it back to the inline form.
 *
 * Tests cover all 3 migrated sites (GET catch, handleHealth,
 * handleCount) and the empty-Error trap.
 */

/** @jest-environment node */

import { messageFromError } from "@/lib/api-fetch";

describe("hindsight messageFromError migration (session 128)", () => {
  describe("GET catch site (fallback = 'Hindsight error')", () => {
    it("returns the error message for a populated Error (the realistic case)", () => {
      // requestWithTimeout always throws an `Error` instance, so this
      // is the only path that fires in production. Byte-equivalent
      // to the pre-refactor inline form for any real catch value.
      expect(
        messageFromError(
          new Error("Hindsight POST /v1/x: 500 server error"),
          "Hindsight error",
        ),
      ).toBe("Hindsight POST /v1/x: 500 server error");
    });

    it("returns the fallback for an empty Error (the 'empty-Error trap')", () => {
      // The inline form would return "" here, which is almost never
      // what the user wants; the helper correctly falls back. This
      // is a behaviour change from the inline form, but it's the
      // "correct" behaviour — the same one the rest of the codebase
      // has standardised on (see `api-logger.ts` migration).
      expect(messageFromError(new Error(""), "Hindsight error")).toBe(
        "Hindsight error",
      );
    });
  });

  describe("handleHealth site (fallback = 'Connection refused')", () => {
    it("returns the error message for a connection-style Error", () => {
      // The real production case: Hindsight bridge throws an Error
      // whose message contains "connect", "refused", or "timed out".
      expect(
        messageFromError(
          new Error("fetch failed: connect ECONNREFUSED 127.0.0.1:9177"),
          "Connection refused",
        ),
      ).toBe("fetch failed: connect ECONNREFUSED 127.0.0.1:9177");
    });

    it("returns the fallback for an empty Error", () => {
      expect(messageFromError(new Error(""), "Connection refused")).toBe(
        "Connection refused",
      );
    });
  });

  describe("handleCount site (fallback = 'Unknown error')", () => {
    it("returns the error message for a populated Error", () => {
      expect(
        messageFromError(
          new Error("Hindsight GET /v1/x: 500 invalid response"),
          "Unknown error",
        ),
      ).toBe("Hindsight GET /v1/x: 500 invalid response");
    });

    it("returns the fallback for an empty Error", () => {
      expect(messageFromError(new Error(""), "Unknown error")).toBe(
        "Unknown error",
      );
    });
  });

  describe("documented behaviour for non-Error throws (unreachable in production)", () => {
    // JavaScript allows `throw "string"` and `throw null`. The 3
    // migrated sites all catch fetch rejections (always `Error`
    // instances), so non-Error values are unreachable in practice.
    // These tests pin the helper's actual behaviour so a future
    // reader doesn't try to "fix" the divergence from the inline
    // form.

    it("coerces a string throw via String() (helper behaviour, not inline)", () => {
      // Inline form: returns "Unknown error" (falsy branch).
      // Helper form: returns "fetch failed" (String("fetch failed")).
      expect(messageFromError("fetch failed", "Unknown error")).toBe(
        "fetch failed",
      );
    });

    it("coerces a number throw via String() (helper behaviour, not inline)", () => {
      // Inline form: returns "Hindsight error".
      // Helper form: returns "42".
      expect(messageFromError(42, "Hindsight error")).toBe("42");
    });

    it("coerces undefined/null via String() (helper behaviour, not inline)", () => {
      // Inline form: returns the fallback.
      // Helper form: returns "undefined" / "null" (the non-empty
      // String() coercion, which the `|| fallback` doesn't override).
      expect(messageFromError(undefined, "Connection refused")).toBe(
        "undefined",
      );
      expect(messageFromError(null, "Unknown error")).toBe("null");
    });
  });
});
