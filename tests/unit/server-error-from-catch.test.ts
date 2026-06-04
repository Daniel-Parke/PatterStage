/**
 * serverErrorFromCatch — unit tests for the combined "log + return
 * serverError" catch-block shim.
 *
 * The helper composes `logApiError(route, context, error)` +
 * `serverError(message)` so the canonical
 *
 *   } catch (error) {
 *     logApiError("GET /api/models", "listing models", error);
 *     return serverError("Failed to list models");
 *   }
 *
 * pattern collapses to a single token
 *
 *   } catch (error) {
 *     return serverErrorFromCatch("GET /api/models", "listing models", error, "Failed to list models");
 *   }
 *
 * at the 27 List 4 call sites. Tests cover (1) the log line is emitted
 * with the canonical `[API <route>] Error <context>: <message>` shape,
 * (2) the returned NextResponse has the 500 status + `{ error: <msg> }`
 * body, and (3) the inline-form 2-line block produces a byte-equivalent
 * log+response pair (via the byte-equivalence matrix).
 */

import {
  logApiError,
  serverErrorFromCatch,
} from "@/lib/api-logger";
import { serverError } from "@/lib/api-response";

describe("serverErrorFromCatch", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns a 500 NextResponse with the user-facing message", async () => {
    const res = serverErrorFromCatch(
      "GET /api/models",
      "listing models",
      new Error("DB connection lost"),
      "Failed to list models",
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to list models" });
  });

  it("emits a console.error with the canonical log shape", () => {
    serverErrorFromCatch(
      "GET /api/models",
      "listing models",
      new Error("DB connection lost"),
      "Failed to list models",
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API GET /api/models] Error listing models: DB connection lost",
    );
  });

  it("handles non-Error throws the same way as logApiError (String(err) fallback)", () => {
    serverErrorFromCatch(
      "POST /api/seed",
      "seed",
      "string error",
      "Failed to run seed",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API POST /api/seed] Error seed: string error",
    );
  });

  it("handles null/undefined throws", () => {
    serverErrorFromCatch("GET /api/x", "read", null, "Failed");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API GET /api/x] Error read: null",
    );
    consoleErrorSpy.mockClear();
    serverErrorFromCatch("GET /api/x", "read", undefined, "Failed");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[API GET /api/x] Error read: undefined",
    );
  });

  it("preserves the user-facing message verbatim — empty string is valid", async () => {
    const res = serverErrorFromCatch("GET /api/x", "read", new Error("oops"), "");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "" });
  });

  it("preserves the user-facing message verbatim — special characters", async () => {
    const res = serverErrorFromCatch(
      "PUT /api/config",
      "updating config",
      new Error("oops"),
      "Failed to write file: /tmp/foo bar/baz.md",
    );
    const body = await res.json();
    expect(body.error).toBe("Failed to write file: /tmp/foo bar/baz.md");
  });
});

describe("serverErrorFromCatch — byte-equivalence to inline form", () => {
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
  // the response shape. Avoids the .clone() trap (jest doesn't
  // substitute a full NextResponse).
  async function runInline(
    route: string,
    context: string,
    err: unknown,
    message: string,
  ): Promise<{ status: number; body: unknown; logCall: string }> {
    consoleErrorSpy.mockClear();
    try {
      const _ignore = (() => {
        throw err;
      })();
      return _ignore as never;
    } catch (caught) {
      logApiError(route, context, caught);
      const res = serverError(message);
      const body = await res.json();
      return {
        status: res.status,
        body,
        logCall: consoleErrorSpy.mock.calls[0][0] as string,
      };
    }
  }

  // Helper: run the serverErrorFromCatch helper, return same shape.
  async function runHelper(
    route: string,
    context: string,
    err: unknown,
    message: string,
  ): Promise<{ status: number; body: unknown; logCall: string }> {
    consoleErrorSpy.mockClear();
    const res = serverErrorFromCatch(route, context, err, message);
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
    message: string;
  }> = [
    {
      label: "Error instance",
      route: "GET /api/models",
      context: "listing models",
      error: new Error("DB connection lost"),
      message: "Failed to list models",
    },
    {
      label: "Error with empty message",
      route: "PUT /api/config",
      context: "updating config",
      error: new Error(""),
      message: "Failed to update config",
    },
    {
      label: "string throw",
      route: "POST /api/seed",
      context: "seed",
      error: "raw string",
      message: "Failed to run seed",
    },
    {
      label: "null throw",
      route: "DELETE /api/models/foo",
      context: "deleting model",
      error: null,
      message: "Failed to delete model",
    },
    {
      label: "TypeError (subclass of Error)",
      route: "GET /api/models/foo",
      context: "reading model",
      error: new TypeError("x is not a function"),
      message: "Failed to load model",
    },
  ];

  for (const s of scenarios) {
    it(`matches the inline 2-line block for: ${s.label}`, async () => {
      const inlineResult = await runInline(s.route, s.context, s.error, s.message);
      const helperResult = await runHelper(s.route, s.context, s.error, s.message);
      expect(helperResult.status).toBe(inlineResult.status);
      expect(helperResult.body).toEqual(inlineResult.body);
      expect(helperResult.logCall).toBe(inlineResult.logCall);
    });
  }
});
