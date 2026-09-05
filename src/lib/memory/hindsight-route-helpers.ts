// ═══════════════════════════════════════════════════════════════
// Hindsight Route Helpers — Pure helpers used by /api/memory/hindsight
// ═══════════════════════════════════════════════════════════════
//
// Extracted from src/app/api/memory/hindsight/route.ts so the small
// repeated shapes that don't depend on the HTTP transport can be
// unit-tested in isolation and re-imported if a future route needs
// the same pattern.
//
// Helpers in this module:
//   - `extractListItems`       — array-or-items unwrap for list responses
//   - `buildPartialUpdateBody` — directive/model partial-update shape
//   - `deleteByType`           — directive/model delete dispatcher
//   - `hindsightErrorEnvelope` — `{ available: false, error: ... }` body
//
// The bodies are pure data-shaping; no DB or fetch calls live here.

import { NextResponse } from "next/server";
import { messageFromError } from "@/lib/api-fetch";
import { logApiError } from "@/lib/api-logger";
import type { ApiResponse } from "@/types/console";

/**
 * Unwrap a list-style Hindsight response into a plain array.
 *
 * Hindsight's list endpoints (`/v1/.../directives`, `/v1/.../mental-models`,
 * etc.) are inconsistent: some return a bare JSON array, others return
 * `{ items: [...] }`. The route previously inlined
 *   `Array.isArray(result) ? result : (result.items || [])`
 * in two places. This helper collapses that to a single import and
 * gives the shape a name so a future maintainer can grep for
 * "extractListItems" rather than re-discover the two sites.
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

// ── Partial-update body builder ──────────────────────────────────────
//
// Both `handleUpdateDirective` and `handleUpdateMentalModel` had the
// same shape: take an updates object, only copy `defined` fields into
// the PATCH body, and apply one transformation per field (e.g.
// `is_active: String(raw) === "true"` for the directive's string-typed
// boolean). Keeping that loop in one place means a future directive
// field lands in `FIELD_MAP` and `MentalModelFieldMap` in lockstep.

export type UpdateBodyBuilder<TKey extends string> = (
  raw: unknown,
) => [TKey, unknown] | null;

/**
 * Build a PATCH body from an `updates` object, applying per-field
 * transforms and skipping undefined fields.
 *
 *   buildPartialUpdateBody(
 *     { name: "X", priority: undefined, is_active: "true" },
 *     { name: copy, priority: copy, is_active: boolFromString },
 *   )
 *   // → { name: "X", is_active: true }
 *
 * `null` is treated like `undefined` (field is dropped). Use a
 * builder that returns the field unchanged for the rare "explicit
 * null clears the field" case.
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

/**
 * Convert a string-or-boolean value into a real boolean. Used by the
 * directive PATCH which expects a typed `is_active` boolean, not the
 * string the client sends.
 */
const boolFromString: UpdateBodyBuilder<string> = (raw) => [
  "is_active",
  String(raw) === "true",
];

/**
 * Map of Hindsight directive update field builders. Add a directive
 * field here (and in the TypeScript interface on the route) and
 * `handleUpdateDirective` picks it up automatically.
 */
export const DIRECTIVE_UPDATE_FIELDS = {
  name: copyField,
  content: copyField,
  priority: copyField,
  is_active: boolFromString,
  // tags handled separately (normalizeTags transform)
};

/**
 * Map of Hindsight mental-model update field builders. `query` maps
 * to the wire field `source_query`, so we override the wire name.
 */
export const MENTAL_MODEL_UPDATE_FIELDS = {
  name: copyField,
  query: copyField,
  // tags handled separately (normalizeTags transform)
};

// ── Error envelope ────────────────────────────────────────────────────
//
// The 500-fallback response in the POST and DELETE handlers was the
// same `{ data: { available: false, error: msg } }` body twice.
// The GET handler has a slightly larger fallback body (it includes
// `memories: []` and uses 503 for connection errors), so it stays
// inline. This helper centralises the 500/POST-or-DELETE shape and
// is a no-op for the GET handler.

/**
 * Build a `NextResponse` carrying `{ available: false, error: msg }`
 * in the success envelope with a 500 status. Use for the POST/DELETE
 * catch branches in this route. The GET catch branch has a different
 * body (it includes `memories: []`) and uses 503 for connection
 * errors — see the inline call in the GET handler.
 *
 * **Prefer `hindsightErrorFromCatch` for new sites** — this helper
 * builds the response shape only, the caller still needs to call
 * `logApiError(route, context, error)` separately. The combined
 * helper composes both side effects and is the right shape for any
 * 2-line `logApiError + return hindsightErrorResponse(error)` block
 * (the canonical List 1 catch pattern, mirroring the session's
 * `serverErrorFromCatch` family).
 */
export function hindsightErrorResponse(error: unknown): NextResponse {
  const message = messageFromError(error, "Unknown error");
  return NextResponse.json<ApiResponse<Record<string, unknown>>>(
    { data: { available: false, error: message } },
    { status: 500 },
  );
}

/**
 * Combined "log + return hindsightErrorResponse" helper for the
 * canonical
 *
 *   } catch (error) {
 *     logApiError("POST /api/memory/hindsight", "action", error);
 *     return hindsightErrorResponse(error);
 *   }
 *
 * pattern repeated at the 2 POST/DELETE catch sites in
 * `src/app/api/memory/hindsight/route.ts`. Mirrors the
 * `serverErrorFromCatch` shim in `src/lib/api-logger.ts` —
 * the same byte-equivalent collapse: same log line
 *   `[API <route>] Error <context>: <error.message>`
 * (via `logApiError` + `messageFromError` for the empty-Error trap)
 * and same response shape (500 + `{ data: { available: false, error: msg } }`).
 *
 * **Why this lives in `hindsight-route-helpers.ts`** (not
 * `api-logger.ts`): the catch-block shim composes two existing
 * primitives (`logApiError` from `api-logger` + `hindsightErrorResponse`
 * from this file). The natural home is the file that owns the
 * response-shape primitive. `api-logger.ts` is the generic catch-shim
 * family (`serverErrorFromCatch`, `serverErrorFromError`); the
 * hindsight-specific shim is a sister-helper that targets a different
 * response shape (the `{ available: false, error: ... }` envelope used
 * by the Hindsight client, not the plain `{ error: ... }` shape used
 * by `serverError`). A generic `serverErrorFromCatch` that supports
 * the hindsight envelope would need a `shape: "default" | "hindsight"`
 * discriminator — clearer to keep two helper families.
 *
 * **Why not also use this for the GET catch branch:** the GET
 * catch branch has a different body (it includes `memories: []`)
 * and uses 503 for connection errors — the inline call stays
 * inline. This helper is for the POST/DELETE catch only.
 *
 * @param route - API route name (e.g. "POST /api/memory/hindsight")
 * @param context - What was being done (e.g. "action")
 * @param error - The caught error
 * @returns A 500 NextResponse with `{ data: { available: false, error: msg } }`
 *
 * @example
 *   } catch (error) {
 *     return hindsightErrorFromCatch("POST /api/memory/hindsight", "action", error);
 *   }
 */
export function hindsightErrorFromCatch(
  route: string,
  context: string,
  error: unknown,
): NextResponse {
  logApiError(route, context, error);
  return hindsightErrorResponse(error);
}
