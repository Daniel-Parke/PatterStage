/**
 * /api/memory/route.ts — regression tests for the unified
 * `unsupportedWriteHandler` refactor. Before the refactor, the
 * POST/PUT/DELETE handlers each had 4 lines of identical code:
 *
 *   const auth = requireAuth(request);
 *   if (auth) return auth;
 *   return UNSUPPORTED_WRITE_RESPONSE;
 *
 * After the refactor, they all share `unsupportedWriteHandler` so a
 * single change to the message or the auth wiring affects all four
 * verbs at once. This test pins the contract:
 *
 *   - All four write verbs return 400 with the same error string.
 *   - All four write verbs still run the auth check (a missing
 *     AUTH_HEADER should yield a 401, not a 400).
 */

/** @jest-environment node */

import { NextRequest } from "next/server";

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/memory-providers", () => ({
  getMemoryProviderType: jest.fn(() => "hindsight"),
}));

const requireAuthMock = jest.fn((_req: NextRequest): Response | null => null);
jest.mock("@/lib/api-auth", () => ({
  requireAuth: (req: NextRequest): Response | null => requireAuthMock(req),
}));

const SUPPORTED_VERBS = ["POST", "PUT", "DELETE"] as const;
type SupportedVerb = (typeof SUPPORTED_VERBS)[number];

const UNSUPPORTED_MESSAGE_FRAGMENT = "Memory management via the dashboard";

describe("/api/memory write verbs (unsupportedWriteHandler)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockReturnValue(null);
  });

  it.each(SUPPORTED_VERBS)(
    "%s returns a 400 with the agent-tools hint",
    async (verb: SupportedVerb) => {
      const { [verb]: handler } = await import("@/app/api/memory/route");
      const req = new NextRequest("http://localhost/api/memory", { method: verb });
      const res = await handler(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain(UNSUPPORTED_MESSAGE_FRAGMENT);
    },
  );

  it.each(SUPPORTED_VERBS)(
    "%s runs requireAuth before returning the 400",
    async (verb: SupportedVerb) => {
      const { [verb]: handler } = await import("@/app/api/memory/route");
      // Simulate an auth failure: requireAuth returns a 401 response
      // (NextResponse is opaque to us here; we just need a truthy return).
      const authFailure = new Response("Unauthorized", { status: 401 });
      requireAuthMock.mockReturnValueOnce(authFailure);

      const req = new NextRequest("http://localhost/api/memory", { method: verb });
      const res = await handler(req);
      // The handler should short-circuit on the auth failure and return
      // the auth 401, not the unsupported-write 400.
      expect(res.status).toBe(401);
    },
  );
});
