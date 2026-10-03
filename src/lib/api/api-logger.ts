// api-logger — consistent error logging for API routes.

import { serverError } from "./api-response";
import { messageFromError, toError } from "./api-fetch";
import type { NextResponse } from "next/server";

/**
 * Log an API error with context; use in catch blocks instead of empty `catch {}`.
 * @param route - API route name (e.g., "GET /api/cron")
 * @param context - What was being done (e.g., "reading jobs.json")
 * @param error - The caught error
 */
export function logApiError(route: string, context: string, error: unknown): void {
  // messageFromError(err, ""), not String(error): new Error("") should log an empty line, not "Error".
  const message = messageFromError(error, "");
  console.error(`[API ${route}] Error ${context}: ${message}`);
}

/**
 * Log + `serverError`, the canonical API catch block. Here rather than in
 * `api-response.ts`, which stays response-shape only and dependency-free.
 * @param route - API route name (e.g., "GET /api/models")
 * @param context - What was being done (e.g., "listing models")
 * @param error - The caught error
 * @param message - User-facing error message (the "Failed to X" string)
 * @returns A 500 NextResponse with `{ error: message }`
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
 * The dynamic-message sister: a static PREFIX plus the caught error's message.
 * Separate so `serverErrorFromCatch` keeps its static-message-only contract,
 * which `tests/unit/server-error-from-catch-source-patterns.test.ts` relies on.
 * @param route - API route name (e.g., "GET /api/cron/hardware")
 * @param context - What was being done (e.g., "read crontab")
 * @param error - The caught error
 * @param prefix - Static user-facing prefix (e.g., "Failed to read crontab")
 * @returns A 500 NextResponse with `{ error: "<prefix>: <error.message>" }`
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
