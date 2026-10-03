/** @jest-environment node */

// Regression test: /api/stories POST handler must require auth checks
// Bug: stories route was missing requireAuth() and requireAuth()

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getAgentLlmEndpoints: jest.fn(() => ({
    apiUrl: "http://127.0.0.1:9/v1/chat/completions",
    gatewayBase: "http://127.0.0.1:9",
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
jest.mock("@/lib/host/paths", () => require("../helpers/mocks").pathsMock());

jest.mock("@/lib/api/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/modules/rec-room/lib/prompts", () => ({
  getStoryPrompt: jest.fn(() => "system prompt"),
}));

import { NextRequest } from "next/server";

describe("/api/stories auth checks", () => {
  const originalEnv = process.env.CH_READ_ONLY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CH_READ_ONLY = originalEnv;
    } else {
      delete process.env.CH_READ_ONLY;
    }
    jest.clearAllMocks();
  });

  // Read-only refusal is no longer asserted here, because it is no longer
  // enforced here. T-0048 deleted the per-route guard: `src/proxy.ts` refuses
  // every unsafe method under PS_READ_ONLY before a handler runs, so a test that
  // calls this handler directly bypasses the thing it means to check. The
  // guarantee is asserted per route, in both directions, in
  // tests/unit/read-only-actually-reads.test.ts.

  it("POST proceeds when not read-only", async () => {
    delete process.env.CH_READ_ONLY;

    const { POST } = await import("@/app/api/stories/route");
    const request = new NextRequest("http://localhost/api/stories", {
      method: "POST",
      body: JSON.stringify({ action: "list" }),
    });
    const res = await POST(request);

    // Should not be 503 (read-only) or 401 (unauthorized)
    // It may return 200 with empty list or 500 if fs mocks aren't set up
    expect(res.status).not.toBe(503);
    expect(res.status).not.toBe(401);
  });
});
