/** @jest-environment node */
/**
 * B1 (T-0095), D5: every Composer route answers 503 when PS_COMPOSER is off,
 * except the SSE stream, which served an existing run regardless. A feature
 * that is off should not have one door left open, and docs/reference/api.md described
 * the exception rather than closing it.
 */
let composerOn = true;
jest.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: () => composerOn,
}));

const mockGetComposerRun = jest.fn();
jest.mock("@/lib/composer/composer-repository", () => ({
  getComposerRun: (...a: unknown[]) => mockGetComposerRun(...a),
  listNodeRuns: () => [],
}));

const mockSseStream = jest.fn(
  (..._a: unknown[]) =>
    new Response("stream", { status: 200, headers: { "Content-Type": "text/event-stream" } }),
);
jest.mock("@/lib/sse/event-stream", () => ({
  sseStream: (...a: unknown[]) => mockSseStream(...a),
}));

import { NextRequest } from "next/server";

import { GET } from "@/app/api/composer/runs/[id]/events/route";

const ctx = { params: Promise.resolve({ id: "run-1" }) };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/composer/runs/[id]/events", () => {
  it("answers 503 like its siblings when the flag is off, before opening a stream", async () => {
    composerOn = false;
    const res = await GET(new NextRequest("http://localhost/api/composer/runs/run-1/events"), ctx);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/PS_COMPOSER/);
    expect(mockSseStream).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: streams when the flag is on", async () => {
    composerOn = true;
    const res = await GET(new NextRequest("http://localhost/api/composer/runs/run-1/events"), ctx);
    expect(res.status).toBe(200);
    expect(mockSseStream).toHaveBeenCalledTimes(1);
  });
});
