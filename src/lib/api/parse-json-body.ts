// ═══════════════════════════════════════════════════════════════
// JSON body parsing for Next.js route handlers
// ═══════════════════════════════════════════════════════════════
//
// Its own module, not api-auth.ts: many tests stub requireAuth with
// `jest.mock("@/lib/api/api-auth", ...)`, which would break every route that
// imported parseJsonBody from the same module.

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
 * Parse and zod-validate a JSON body. Returns the typed `z.infer<T>` data, or
 * a 400 NextResponse on either failure ("Invalid JSON" via `parseJsonBody`,
 * "Invalid request body" with `details: error.flatten()` via
 * `zodErrorResponse`), so the caller checks `instanceof NextResponse` once.
 * Lives here rather than in `api-schemas.ts`, which stays free of next/server
 * so server actions and tests can import the schemas without it.
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
