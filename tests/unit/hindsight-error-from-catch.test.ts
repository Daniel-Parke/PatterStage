/**
 * hindsightErrorFromCatch — unit tests for the combined
 * "log + return hindsightErrorResponse" catch-block shim.
 *
 * The helper composes `logApiError(route, context, error)` +
 * `hindsightErrorResponse(error)` so the canonical
 *
 *   } catch (error) {
 *     logApiError("POST /api/memory/hindsight", "action", error);
 *     return hindsightErrorResponse(error);
 *   }
 *
 * pattern collapses to a single token
 *
 *   } catch (error) {
 *     return hindsightErrorFromCatch("POST /api/memory/hindsight", "action", error);
 *   }
 *
 * at the 2 POST/DELETE call sites in
 * `src/app/api/memory/hindsight/route.ts`. Tests cover (1) the log
 * line is emitted with the canonical `[API <route>] Error
 * <context>: <message>` shape, (2) the returned NextResponse has
 * the 500 status + `{ data: { available: false, error: msg } }` body,
 * and (3) the inline-form 2-line block produces a byte-equivalent
 * log+response pair (via the byte-equivalence matrix).
 *
 * Sister test: `tests/unit/server-error-from-catch.test.ts` covers
 * the same shape for the `serverErrorFromCatch` shim. The
 * `hindsightErrorFromCatch` shim is the hindsight-specific sister —
 * it composes the same `logApiError` primitive but targets the
 * `{ data: { available: false, error: ... } }` envelope used by the
 * Hindsight client, not the plain `{ error: ... }` shape used by
 * `serverError`. Two helper families, one logApiError primitive.
 */

import { logApiError } from "@/lib/api-logger";
import {
  hindsightErrorFromCatch,
  hindsightErrorResponse,
} from "@/lib/hindsight-route-helpers";

describe("hindsightErrorFromCatch", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns a 500 NextResponse with the hindsight envelope shape", async () => {
    const res = hindsightErrorFromCatch(
      "POST /api/memory/hindsight",
      "action",
      new Error("DB connection lost"),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    // The Hindsight client expects `{ data: { available: false, error: msg } }`
    // — NOT the plain `{ error: ... }` shape used by serverError.
    expect(body).toEqual({
      data: { available: false, error: "DB connection lost" },
    });
  });

  it("emits a console.error with the canonical log shape", () => {
    hindsightErrorFromCatch(
      "POST /api/memory/hindsight",
      "action",
      new Error("DB connection lost"),
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API POST /api/memory/hindsight] Error action: DB connection lost",
    );
  });

  it("handles non-Error throws the same way as logApiError (String(err) fallback)", () => {
    hindsightErrorFromCatch(
      "POST /api/memory/hindsight",
      "action",
      "string error",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API POST /api/memory/hindsight] Error action: string error",
    );
  });

  it("handles null/undefined throws", () => {
    hindsightErrorFromCatch("DELETE /api/memory/hindsight", "delete", null);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API DELETE /api/memory/hindsight] Error delete: null",
    );
    consoleErrorSpy.mockClear();
    hindsightErrorFromCatch("DELETE /api/memory/hindsight", "delete", undefined);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API DELETE /api/memory/hindsight] Error delete: undefined",
    );
  });

  it("uses 'Unknown error' fallback for empty Error messages", async () => {
    const res = hindsightErrorFromCatch(
      "POST /api/memory/hindsight",
      "action",
      new Error(""),
    );
    const body = await res.json();
    // hindsightErrorResponse uses `messageFromError(error, "Unknown error")`
    // — so the empty-Error trap is handled by the response body, NOT
    // by logApiError (which keeps the empty-string form for log fidelity).
    expect(body).toEqual({ data: { available: false, error: "Unknown error" } });
  });

  it("preserves the user-facing error message verbatim for non-Error throws", async () => {
    const res = hindsightErrorFromCatch(
      "POST /api/memory/hindsight",
      "action",
      "raw string",
    );
    const body = await res.json();
    expect(body).toEqual({ data: { available: false, error: "raw string" } });
  });
});

describe("hindsightErrorFromCatch — byte-equivalence to inline form", () => {
  // Per session-51 lesson: for any refactor that swaps an inline
  // response for a helper, verify the helper's output matches the
  // inline block's output for every reachable input shape. We compare
  // (status, body) pairs and (console.error) call arguments directly.
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // Helper: run the inline 2-line block, return the captured log call +
  // the response shape.
  async function runInline(
    route: string,
    context: string,
    err: unknown,
  ): Promise<{ status: number; body: unknown; logCall: string }> {
    consoleErrorSpy.mockClear();
    try {
      const _ignore = (() => {
        throw err;
      })();
      return _ignore as never;
    } catch (caught) {
      logApiError(route, context, caught);
      const res = hindsightErrorResponse(caught);
      const body = await res.json();
      return {
        status: res.status,
        body,
        logCall: consoleErrorSpy.mock.calls[0][0] as string,
      };
    }
  }

  // Helper: run the hindsightErrorFromCatch helper, return same shape.
  async function runHelper(
    route: string,
    context: string,
    err: unknown,
  ): Promise<{ status: number; body: unknown; logCall: string }> {
    consoleErrorSpy.mockClear();
    const res = hindsightErrorFromCatch(route, context, err);
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
  }> = [
    {
      label: "Error instance",
      route: "POST /api/memory/hindsight",
      context: "action",
      error: new Error("DB connection lost"),
    },
    {
      label: "Error with empty message",
      route: "PUT /api/memory/hindsight",
      context: "updating",
      error: new Error(""),
    },
    {
      label: "string throw",
      route: "POST /api/memory/hindsight",
      context: "action",
      error: "raw string",
    },
    {
      label: "null throw",
      route: "DELETE /api/memory/hindsight",
      context: "delete",
      error: null,
    },
    {
      label: "TypeError (subclass of Error)",
      route: "GET /api/memory/hindsight",
      context: "action=health",
      error: new TypeError("x is not a function"),
    },
  ];

  for (const s of scenarios) {
    it(`matches the inline 2-line block for: ${s.label}`, async () => {
      const inlineResult = await runInline(s.route, s.context, s.error);
      const helperResult = await runHelper(s.route, s.context, s.error);
      expect(helperResult.status).toBe(inlineResult.status);
      expect(helperResult.body).toEqual(inlineResult.body);
      expect(helperResult.logCall).toBe(inlineResult.logCall);
    });
  }
});
