/**
 * @jest-environment node
 *
 * Tests for `GET /api/gateway/models` — the empty-fallback fix.
 *
 * Background: the route used to return a hardcoded `DEFAULT_MODELS`
 * list (including phantom models like `deepseek/deepseek-v4-flash`
 * and `anthropic/claude-sonnet-4`) whenever the gateway was offline
 * or returned a non-2xx. The chat page's `mergedModels` hook then
 * surfaced those phantom IDs as user-selectable options, even
 * though they were not in the PatterStage Models registry.
 *
 * The fix is: when the gateway is unreachable or returns a non-2xx,
 * the route returns `{ data: { models: [] } }`. The chat page
 * already shows a `modelsError` badge when the gateway is offline,
 * and the registry (which the chat page ALSO consults) is the
 * source of truth for which models the user can pick.
 *
 * The phantom model strings are locked out as anti-patterns below —
 * if a future commit re-introduces a `DEFAULT_MODELS` constant or
 * the route starts returning the phantom names again, these tests
 * fail with a clear diff.
 */

import { GET } from "@/app/api/gateway/models/route";

import * as fs from "fs";
import * as path from "path";

// ── Mocks ───────────────────────────────────────────────────────

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

// Resolve gateway URLs against a fixed base so the test isn't
// sensitive to whatever `~/.hermes/.env` happens to say. The
// gateway-client reads `HERMES_GATEWAY_URL` (or falls back to
// `getAgentLlmEndpoints()`), so we set the env var before the
// route module is evaluated.
const ORIGINAL_ENV = process.env;
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, HERMES_GATEWAY_URL: "http://127.0.0.1:9" };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ── Tests ───────────────────────────────────────────────────────

describe("GET /api/gateway/models — empty fallback on error", () => {
  it("returns an empty list (NOT a hardcoded default) when the gateway is unreachable (network error)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:9"));
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ data: { models: [] } });
  });

  it("returns an empty list when the gateway returns 5xx", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => "bad gateway",
      json: async () => ({ error: "bad gateway" }),
    } as Response);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ data: { models: [] } });
  });

  it("returns an empty list when the gateway returns 2xx but no data array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ not_data: "anything" }),
    } as Response);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ data: { models: [] } });
  });

  it("returns the actual model list when the gateway is healthy", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "hermes-agent" }] }),
    } as Response);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ data: { models: ["hermes-agent"] } });
  });

  it("accepts string[] model entries (alternative gateway payload shape)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: ["hermes-agent", "openai/gpt-4o"] }),
    } as Response);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({
      data: { models: ["hermes-agent", "openai/gpt-4o"] },
    });
  });

  it("filters out empty/falsy model IDs from the gateway response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "keep-this" }, { id: "" }, { id: null }] }),
    } as Response);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ data: { models: ["keep-this"] } });
  });
});

describe("GET /api/gateway/models — anti-pattern locks", () => {
  /**
   * These are static source-pattern locks — they read the route
   * source and assert the phantom model strings never re-appear
   * in any error/fallback path. A future refactor that adds a
   * `DEFAULT_MODELS` constant with the same phantom strings will
   * fail these tests with a clear message.
   *
   * Pattern source: the chat page test
   * (`tests/unit/chat-page-active-session-reuse.test.ts`).
   */
  const ROUTE_SOURCE = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/app/api/gateway/models/route.ts",
    ),
    "utf-8",
  );

  it("does not export or reference `DEFAULT_MODELS` (the hardcoded phantom list)", () => {
    expect(ROUTE_SOURCE).not.toMatch(/DEFAULT_MODELS/);
  });

  it("does not hardcode the phantom `deepseek/deepseek-v4-flash` string as a code value (string literal or array element)", () => {
    // Match the value as a quoted string literal — e.g. `"deepseek/..."`
    // or `'deepseek/...'` — but not as a comment mention in a // or * line.
    const lines: string[] = ROUTE_SOURCE.split("\n");
    const codeLines: string[] = lines.filter(
      (l: string) => !/^\s*(\/\/|\*|\/\*)/.test(l),
    );
    const codeSource: string = codeLines.join("\n");
    expect(codeSource).not.toMatch(/["']deepseek\/deepseek-v4-flash["']/);
  });

  it("does not hardcode the phantom `anthropic/claude-sonnet-4` string as a code value", () => {
    const lines: string[] = ROUTE_SOURCE.split("\n");
    const codeLines: string[] = lines.filter(
      (l: string) => !/^\s*(\/\/|\*|\/\*)/.test(l),
    );
    const codeSource: string = codeLines.join("\n");
    expect(codeSource).not.toMatch(/["']anthropic\/claude-sonnet-4["']/);
  });
});
