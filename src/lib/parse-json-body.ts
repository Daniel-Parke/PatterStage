// ═══════════════════════════════════════════════════════════════
// JSON body parsing helper for Next.js route handlers
// ═══════════════════════════════════════════════════════════════
//
// Safely parse the JSON body of a NextRequest.
// Returns the parsed object on success, or a NextResponse (400) on parse failure.
//
// Usage:
//   const body = await parseJsonBody(request);
//   if (body instanceof NextResponse) return body;
//   // body is now Record<string, unknown>
//
// Lives in its own module (not api-auth.ts) so route-level tests that mock
// @/lib/api-auth don't need to know about it. Many tests stub requireAuth
// directly with `jest.mock("@/lib/api-auth", () => ({ requireAuth: ... }))`,
// which would otherwise break the routes that import parseJsonBody from
// the same module.

import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema, z } from "zod";

import { badRequest } from "./api-response";
import { zodErrorResponse } from "./api-schemas";

export async function parseJsonBody(
  request: NextRequest,
): Promise<Record<string, unknown> | ReturnType<typeof badRequest>> {
  try {
    const body = await request.json();
    return body as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON");
  }
}

/**
 * Combined JSON body parse + zod validation for NextRequest.
 *
 * Collapses the 4-line `parseJsonBody → instance check → safeParse →
 * zodErrorResponse` sequence that was duplicated across 10+ models/*
 * routes (POST fallbacks/toggle/reorder/custom/import/sync, PUT
 * fallbacks/[id], POST model, PUT model/[id], PUT models/defaults, and
 * elsewhere) into a single call. Returns the typed `z.infer<T>` data on
 * success, or a NextResponse (400) on either parse failure or schema
 * validation failure — caller checks `instanceof NextResponse` exactly
 * once and returns.
 *
 * Byte-equivalent to the inline form:
 *   1. `request.json()` throws → 400 "Invalid JSON" (via `parseJsonBody`)
 *   2. `schema.safeParse(body)` returns `{success: false}` → 400
 *      "Invalid request body" with `details: error.flatten()` (via
 *      `zodErrorResponse`)
 *
 * **Why this lives in `parse-json-body.ts`** (not `api-schemas.ts`):
 * the helper is a *body-parse* concern that happens to also validate.
 * `api-schemas.ts` is schemas-only (no NextRequest coupling), and adding
 * a `NextRequest`-typed helper there would force every consumer of the
 * zod schemas (server actions, tests, etc.) to also pull in next/server.
 *
 * @example
 *   const parsed = await parseAndValidateJsonBody(request, modelPostSchema);
 *   if (parsed instanceof NextResponse) return parsed;
 *   // parsed is now z.infer<typeof modelPostSchema>
 */
export async function parseAndValidateJsonBody<T extends ZodSchema>(
  request: NextRequest,
  schema: T,
): Promise<z.infer<T> | NextResponse> {
  const body = await parseJsonBody(request);
  if (body instanceof NextResponse) return body;
  const result = schema.safeParse(body);
  if (!result.success) return zodErrorResponse(result.error);
  return result.data;
}
