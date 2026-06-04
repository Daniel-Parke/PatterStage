/**
 * serverErrorFromError — unit tests for the dynamic-message sister-helper
 * of `serverErrorFromCatch`.
 *
 * The helper composes `logApiError(route, context, error)` +
 * `serverError(\`${prefix}: ${toError(error).message}\`)` so the canonical
 *
 *   } catch (e) {
 *     logApiError(ROUTE, CONTEXT, e);
 *     return serverError(`Failed to read crontab: ${toError(e).message}`);
 *   }
 *
 * pattern collapses to a single token
 *
 *   } catch (e) {
 *     return serverErrorFromError(ROUTE, CONTEXT, e, "Failed to read crontab");
 *   }
 *
 * at the 4 `api/cron/hardware/route.ts` call sites (GET, POST, PUT, DELETE).
 *
 * This is a SISTER test to `server-error-from-catch.test.ts` (same shape,
 * same log+response contract) — but covers the dynamic-message form
 * instead of the static-message form. The two helpers are byte-equivalent
 * to their respective inline forms; this file pins the dynamic-form
 * contract so future "optimizations" that break it (e.g. dropping the
 * `: ` separator, omitting the toError() coercion, swallowing empty
 * messages differently) fail the test suite.
 *
 * **Why sister-test not extension:** the dynamic-message form has a
 * different message-source shape (prefix + caught error's message, vs
 * fully-static string). A separate test file with its own byte-equivalence
 * matrix and its own non-Error-throw scenarios is clearer than mixing the
 * two in a single file with conditional fixtures. Sister-test pattern
 * per `refactor-sweep-rolling-doc-safety` Pitfall 5 ("catch-block shim
 * family") and `refactor-sweep-mission` session-125 P-1.
 */

import {
  logApiError,
  serverErrorFromError,
} from "@/lib/api-logger";
import { serverError } from "@/lib/api-response";
import { toError } from "@/lib/api-fetch";

describe("serverErrorFromError", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns a 500 NextResponse with `${prefix}: ${error.message}` body", async () => {
    const res = serverErrorFromError(
      "GET /api/cron/hardware",
      "read crontab",
      new Error("permission denied"),
      "Failed to read crontab",
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to read crontab: permission denied" });
  });

  it("emits a console.error with the canonical log shape", () => {
    serverErrorFromError(
      "GET /api/cron/hardware",
      "read crontab",
      new Error("permission denied"),
      "Failed to read crontab",
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API GET /api/cron/hardware] Error read crontab: permission denied",
    );
  });

  it("handles non-Error throws the same way as the inline form (toError coerces)", () => {
    serverErrorFromError(
      "POST /api/cron/hardware",
      "create hardware cron",
      "raw string",
      "Failed to create hardware cron job",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API POST /api/cron/hardware] Error create hardware cron: raw string",
    );
  });

  it("handles null/undefined throws", () => {
    serverErrorFromError("GET /api/x", "read", null, "Failed to read");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API GET /api/x] Error read: null",
    );
    consoleErrorSpy.mockClear();
    serverErrorFromError("GET /api/x", "read", undefined, "Failed to read");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API GET /api/x] Error read: undefined",
    );
  });

  it("preserves the prefix verbatim — special characters allowed", async () => {
    const res = serverErrorFromError(
      "PUT /api/cron/hardware",
      "update hardware cron",
      new Error("oops"),
      "Failed to update hardware cron job: at /etc/cron.d/hermes",
    );
    const body = await res.json();
    expect(body.error).toBe(
      "Failed to update hardware cron job: at /etc/cron.d/hermes: oops",
    );
  });
});

describe("serverErrorFromError — byte-equivalence to inline form", () => {
  // Per session-51 lesson: for any refactor that swaps an inline response
  // for a helper, verify the helper's output matches the inline block's
  // output for every reachable input shape. We compare (status, body)
  // pairs and (console.error) call arguments directly.
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // Helper: run the inline 2-line block, return the captured log call +
  // the response shape. Avoids the .clone() trap (jest doesn't
  // substitute a full NextResponse).
  async function runInline(
    route: string,
    context: string,
    err: unknown,
    prefix: string,
  ): Promise<{ status: number; body: unknown; logCall: string }> {
    consoleErrorSpy.mockClear();
    try {
      const _ignore = (() => {
        throw err;
      })();
      return _ignore as never;
    } catch (caught) {
      logApiError(route, context, caught);
      const res = serverError(`${prefix}: ${toError(caught).message}`);
      const body = await res.json();
      return {
        status: res.status,
        body,
        logCall: consoleErrorSpy.mock.calls[0][0] as string,
      };
    }
  }

  // Helper: run the serverErrorFromError helper, return same shape.
  async function runHelper(
    route: string,
    context: string,
    err: unknown,
    prefix: string,
  ): Promise<{ status: number; body: unknown; logCall: string }> {
    consoleErrorSpy.mockClear();
    const res = serverErrorFromError(route, context, err, prefix);
    const body = await res.json();
    return {
      status: res.status,
      body,
      logCall: consoleErrorSpy.mock.calls[0][0] as string,
    };
  }

  const scenarios: Array<{
    label: string;
    route: string;
    context: string;
    error: unknown;
    prefix: string;
  }> = [
    {
      label: "Error instance",
      route: "GET /api/cron/hardware",
      context: "read crontab",
      error: new Error("permission denied"),
      prefix: "Failed to read crontab",
    },
    {
      label: "Error with empty message",
      route: "PUT /api/cron/hardware",
      context: "update hardware cron",
      error: new Error(""),
      prefix: "Failed to update hardware cron job",
    },
    {
      label: "string throw",
      route: "POST /api/cron/hardware",
      context: "create hardware cron",
      error: "raw string",
      prefix: "Failed to create hardware cron job",
    },
    {
      label: "null throw",
      route: "DELETE /api/cron/hardware",
      context: "delete hardware cron",
      error: null,
      prefix: "Failed to delete hardware cron job",
    },
    {
      label: "TypeError (subclass of Error)",
      route: "GET /api/cron/hardware",
      context: "read crontab",
      error: new TypeError("x is not a function"),
      prefix: "Failed to read crontab",
    },
  ];

  for (const s of scenarios) {
    it(`matches the inline 2-line block for: ${s.label}`, async () => {
      const inlineResult = await runInline(s.route, s.context, s.error, s.prefix);
      const helperResult = await runHelper(s.route, s.context, s.error, s.prefix);
      expect(helperResult.status).toBe(inlineResult.status);
      expect(helperResult.body).toEqual(inlineResult.body);
      expect(helperResult.logCall).toBe(inlineResult.logCall);
    });
  }

  it("documents the empty-Error trap divergence from naive `toError(e).message`", async () => {
    // The naive inline form would produce: "Failed: " (empty after colon)
    // The helper preserves the inline form's output byte-for-byte via
    // the toError(e).message coercion, which gives "" for new Error("").
    // The wire-level response is identical to the inline form — this test
    // pins the behaviour so a future "fix" doesn't accidentally tighten
    // the helper to skip the empty message.
    const inlineResult = await runInline(
      "GET /api/cron/hardware",
      "read crontab",
      new Error(""),
      "Failed to read crontab",
    );
    const helperResult = await runHelper(
      "GET /api/cron/hardware",
      "read crontab",
      new Error(""),
      "Failed to read crontab",
    );
    expect(helperResult.body).toEqual(inlineResult.body);
    expect((helperResult.body as { error: string }).error).toBe(
      "Failed to read crontab: ",
    );
  });
});
