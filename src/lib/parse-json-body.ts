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

import { NextRequest } from "next/server";

import { badRequest } from "./api-response";

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
