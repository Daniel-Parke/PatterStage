// ═══════════════════════════════════════════════════════════════
// API Logger — consistent error logging for API routes
// ═══════════════════════════════════════════════════════════════

import { serverError } from "./api-response";
import { messageFromError, toError } from "./api-fetch";
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

/**
 * Sister-helper of `serverErrorFromCatch` for the dynamic-message variant.
 * The static-message form (`serverErrorFromCatch`) is for sites where the
 * user-facing error string is a static literal (e.g. "Failed to list
 * models"). The dynamic-message form (`serverErrorFromError`) is for
 * sites where the user-facing string is a static PREFIX concatenated with
 * the caught error's message — the canonical pattern is
 *
 *   } catch (e) {
 *     logApiError(ROUTE, CONTEXT, e);
 *     return serverError(`Failed to read crontab: ${toError(e).message}`);
 *   }
 *
 * which appears in 4 sites in `api/cron/hardware/route.ts` (GET, POST,
 * PUT, DELETE handlers). The inline template-literal interpolation is a
 * discriminator (Pitfall 4 / `audit-recipes-and-migration-status.md`)
 * that excludes the site from `serverErrorFromCatch` — but the log +
 * response composition is the same shape, so a dedicated helper that
 * takes a `prefix` instead of a fully-formed `message` is the natural
 * cousin.
 *
 * Byte-equivalent to the inline form: same log line
 *   [API <route>] Error <context>: <error.message>
 * (via `logApiError` which uses `messageFromError` for the `||` empty-Error
 * discipline) and same response (500 + `{ error: "<prefix>: <error.message>" }`).
 * The response body is identical character-for-character to the inline
 * template-literal form for all `Error`-instance inputs (which is the
 * realistic case for `try` blocks around `fs` / `child_process` /
 * `db.prepare().run()` operations).
 *
 * **Why not extend `serverErrorFromCatch` to accept an optional `prefix`:**
 * the two helpers have different message-source semantics — static
 * (caller-supplied, never changes) vs dynamic (caller-supplied PREFIX +
 * caught error's message). A `prefix?` optional 4th-arg would muddy the
 * static-only contract that `serverErrorFromCatch` enforces (and that
 * the source-pattern test in `tests/unit/server-error-from-catch-
 * source-patterns.test.ts` relies on). Sister-helpers with distinct
 * signatures is clearer than an overloaded 4th-arg.
 *
 * **Why the `toError` import is here and not in `api-response.ts`:** the
 * helper is a *catch-block shim* that composes two existing primitives
 * (logApiError + serverError + the inner `toError` for the dynamic
 * message). Same module-home argument as `serverErrorFromCatch`.
 *
 * @param route - API route name (e.g., "GET /api/cron/hardware")
 * @param context - What was being done (e.g., "read crontab")
 * @param error - The caught error
 * @param prefix - Static user-facing prefix (e.g., "Failed to read crontab")
 * @returns A 500 NextResponse with `{ error: "<prefix>: <error.message>" }`
 *
 * @example
 *   } catch (e) {
 *     return serverErrorFromError("GET /api/cron/hardware", "read crontab", e, "Failed to read crontab");
 *   }
 */
export function serverErrorFromError(
  route: string,
  context: string,
  error: unknown,
  prefix: string,
): NextResponse {
  logApiError(route, context, error);
  return serverError(`${prefix}: ${toError(error).message}`);
}
