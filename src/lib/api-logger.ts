// ═══════════════════════════════════════════════════════════════
// API Logger — consistent error logging for API routes
// ═══════════════════════════════════════════════════════════════

import { serverError } from "./api-response";
import { messageFromError } from "./api-fetch";
import type { NextResponse } from "next/server";

/**
 * Log an API error with context. Use in catch blocks instead of
 * empty `catch {}` to ensure errors are visible during debugging.
 *
 * @param route - API route name (e.g., "GET /api/cron")
 * @param context - What was being done (e.g., "reading jobs.json")
 * @param error - The caught error
 */
export function logApiError(route: string, context: string, error: unknown): void {
  // The empty-Error trap: new Error("") has message === "" and is an
  // Error instance, so the original `error instanceof Error ? error.message : String(error)`
  // would log an empty line. messageFromError(err, "") keeps the inline
  // form's empty-Error behaviour (returns "") and matches all other input
  // shapes byte-for-byte — see refactor-sweep-rolling-doc-safety
  // Pitfall 8 for the byte-equivalence verification matrix. The "String(error)"
  // fallback is tempting but breaks on new Error("") (it would log
  // "Error" instead of "").
  const message = messageFromError(error, "");
  console.error(`[API ${route}] Error ${context}: ${message}`);
}

/**
 * Combined "log + return serverError" helper for the canonical
 *   } catch (error) {
 *     logApiError(ROUTE, CONTEXT, error);
 *     return serverError(MESSAGE);
 *   }
 * pattern that was duplicated across 27 catch blocks in List 4 territory
 * (models/* routes, config/route, agent/files/[key], seed) and ~75
 * catch blocks across the entire codebase. Each site is a perfectly
 * identical 2-line block — the same `logApiError` call followed by the
 * same `serverError(STATIC_MESSAGE)` return.
 *
 * Byte-equivalent to the inline form: same log line
 *   [API <route>] Error <context>: <error.message>
 * and same response (500 + `{ error: <message> }`). Tests cover the
 * log+response pair end-to-end via console-error spying + NextResponse
 * inspection (see `tests/unit/server-error-from-catch.test.ts`).
 *
 * **Why this lives in `api-logger.ts`** (not `api-response.ts`): the
 * helper is a *catch-block shim* that composes two existing primitives
 * (logApiError + serverError). The natural home is the file where the
 * logApiError side-effect lives. `api-response.ts` is response-shape
 * only (no logging), and adding a logging import there would break
 * its "keep this module tiny and dependency-free" rule (see the
 * `api-response.ts` top comment).
 *
 * **Why not `setErrorFromCaught` / `toastError`-shaped** (which take a
 * setter fn, not a log route): the API catch-block is a *combined
 * log + response* contract — the setter-fn pattern is for client-side
 * `useState` / `showToast` cases where there's no log side-effect. A
 * dedicated `serverErrorFromCatch` matches the API contract (1 call
 * → 1 log + 1 response) without forcing the caller to compose two
 * helpers at every site.
 *
 * @param route - API route name (e.g., "GET /api/models")
 * @param context - What was being done (e.g., "listing models")
 * @param error - The caught error
 * @param message - User-facing error message (the "Failed to X" string)
 * @returns A 500 NextResponse with `{ error: message }`
 *
 * @example
 *   } catch (error) {
 *     return serverErrorFromCatch("GET /api/models", "listing models", error, "Failed to list models");
 *   }
 */
export function serverErrorFromCatch(
  route: string,
  context: string,
  error: unknown,
  message: string,
): NextResponse {
  logApiError(route, context, error);
  return serverError(message);
}
