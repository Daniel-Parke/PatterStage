// Hindsight route helpers — pure data-shaping for /api/memory/hindsight; no DB or fetch calls.

import { NextResponse } from "next/server";
import { messageFromError } from "@/lib/api-fetch";
import { logApiError } from "@/lib/api-logger";
import { memoryFailureMessage } from "@/lib/memory/memory-error-copy";
import type { ApiResponse } from "@/types/console";

/**
 * Unwrap a list-style Hindsight response: its list endpoints return a bare
 * array from some routes and `{ items: [...] }` from others.
 */
export function extractListItems<T = Record<string, unknown>>(
  result: T[] | { items?: T[] } | unknown,
): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { items?: T[] }).items)) {
    return (result as { items: T[] }).items;
  }
  return [];
}

export type UpdateBodyBuilder<TKey extends string> = (
  raw: unknown,
) => [TKey, unknown] | null;

/**
 * Build a PATCH body from an `updates` object, applying per-field transforms
 * and skipping undefined fields. `null` is dropped like `undefined`; a builder
 * that returns the field unchanged serves the rare "explicit null clears" case.
 */
export function buildPartialUpdateBody<TUpdates extends Record<string, unknown>>(
  updates: TUpdates,
  fields: Partial<Record<keyof TUpdates, UpdateBodyBuilder<string>>>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(fields) as Array<keyof TUpdates>) {
    const raw = updates[key];
    if (raw === undefined || raw === null) continue;
    const builder = fields[key]!;
    const built = builder(raw);
    if (built) body[built[0]] = built[1];
  }
  return body;
}

/** Pass-through field builder for `buildPartialUpdateBody`. */
const copyField: UpdateBodyBuilder<string> = (raw) => [String(raw), raw];

/** String-or-boolean to a real boolean: the directive PATCH expects a typed `is_active`, not the client's string. */
const boolFromString: UpdateBodyBuilder<string> = (raw) => [
  "is_active",
  String(raw) === "true",
];

/**
 * Directive update field builders. Add a field here (and to the route's
 * interface) and `handleUpdateDirective` picks it up.
 */
export const DIRECTIVE_UPDATE_FIELDS = {
  name: copyField,
  content: copyField,
  priority: copyField,
  is_active: boolFromString,
  // tags handled separately (normalizeTags transform)
};

/** Mental-model update field builders. `query` maps to the wire field `source_query`. */
export const MENTAL_MODEL_UPDATE_FIELDS = {
  name: copyField,
  query: copyField,
  // tags handled separately (normalizeTags transform)
};

/**
 * A 500 `NextResponse` carrying `{ available: false, error: msg }` for the
 * POST/DELETE catch branches. The GET catch differs (its body includes
 * `memories: []` and it uses 503 for connection errors). Prefer
 * `hindsightErrorFromCatch`, which also logs.
 */
export function hindsightErrorResponse(error: unknown): NextResponse {
  // Translated, not raw: a stopped provider reaches here as Node's "fetch
  // failed: connect ECONNREFUSED ...", and `memoryFailureMessage` applies the
  // SAME rule the banner uses, so toast and banner read alike. A provider that
  // explained itself is still quoted verbatim.
  const message = memoryFailureMessage(messageFromError(error, "Unknown error"));
  return NextResponse.json<ApiResponse<Record<string, unknown>>>(
    // The message goes in BOTH places. Top-level `error` is the only field the
    // client reads on a non-2xx (every 4xx/5xx factory in @/lib/api-response
    // sets it); while it was missing every failure here read as "HTTP 500". The
    // `data` envelope stays because the memory browser reads `data.error` on
    // the 200 path, and one shape for both paths keeps that reader simple.
    { error: message, data: { available: false, error: message } },
    { status: 500 },
  );
}

/**
 * Log the error and return `hindsightErrorResponse`, for the POST/DELETE catch
 * sites (not the GET branch; see above).
 *
 * @param route - API route name (e.g. "POST /api/memory/hindsight")
 * @param context - What was being done (e.g. "action")
 * @param error - The caught error
 * @returns A 500 NextResponse with `{ data: { available: false, error: msg } }`
 */
export function hindsightErrorFromCatch(
  route: string,
  context: string,
  error: unknown,
): NextResponse {
  logApiError(route, context, error);
  return hindsightErrorResponse(error);
}
