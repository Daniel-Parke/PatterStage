/** @jest-environment node */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as yaml from "js-yaml";
import type { NextRequest } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
jest.mock("next/server", () => require("../helpers/mocks").nextServerMock());

jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api/api-auth", () => ({ requireAuth: jest.fn(() => null) }));
jest.mock("@/lib/api/parse-json-body", () => ({
  parseJsonBody: jest.fn(async (req: { json: () => Promise<unknown> }) => req.json()),
  // parseAndValidateJsonBody composes parseJsonBody + zod schema.safeParse.
  // Re-expose the real one so the route's validation step is exercised
  // end-to-end (otherwise the mock would short-circuit the schema and
  // the test would lose coverage of the strict zod object in the route).
  parseAndValidateJsonBody: jest.fn(
    async (req: unknown, schema: { safeParse: (b: unknown) => { success: boolean; data?: unknown; error?: unknown } }) => {
      const body = await (req as { json: () => Promise<unknown> }).json();
      const result = schema.safeParse(body);
      if (!result.success) {
        // Mirror the real helper's 400 response shape.
        return {
          status: 400,
          body: { error: "Invalid request body", details: (result.error as { flatten: () => unknown })?.flatten?.() },
        };
      }
      return result.data;
    },
  ),
}));

const mockUpdateBatch = jest.fn();
const mockGetConfig = jest.fn();
const mockSync = jest.fn();
const mockListChain = jest.fn();
const mockAddEntry = jest.fn();
const mockUpsertModel = jest.fn();

jest.mock("@/lib/models/fallbacks-repository", () => ({
  addFallbackEntry: (...args: unknown[]) => mockAddEntry(...args),
  listFallbackChain: (...args: unknown[]) => mockListChain(...args),
  getFallbackConfig: (...args: unknown[]) => mockGetConfig(...args),
  updateFallbackConfigBatch: (...args: unknown[]) => mockUpdateBatch(...args),
}));

jest.mock("@/modules/hermes/lib/fallback-sync", () => ({
  syncEnabledFallbackChainToHermes: (...args: unknown[]) => mockSync(...args),
}));

jest.mock("@/lib/models/models-repository", () => ({
  upsertModel: (...args: unknown[]) => mockUpsertModel(...args),
}));

let fakeRoot: string;

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => ({
    root: fakeRoot,
    config: join(fakeRoot, "config.yaml"),
    backups: join(fakeRoot, "backups"),
  }),
}));

beforeEach(() => {
  fakeRoot = join(tmpdir(), `ch-fb-import-${Date.now()}`);
  mkdirSync(fakeRoot, { recursive: true });
  writeFileSync(
    join(fakeRoot, "config.yaml"),
    yaml.dump({
      agent: { api_max_retries: 7, restore_primary_on_fallback: false, fallback_notification: true },
      fallback_providers: [{ provider: "openai", model: "gpt-4o" }],
    }),
    "utf-8",
  );
  jest.clearAllMocks();
  mockListChain.mockReturnValue([]);
  mockUpsertModel.mockReturnValue({ id: "m1" });
  mockGetConfig.mockReturnValue({
    restorePrimaryOnFallback: false,
    fallbackNotification: true,
    apiMaxRetries: 7,
  });
});

describe("POST /api/models/fallbacks/import", () => {
  it("imports agent settings from config.yaml into SQLite before re-sync", async () => {
    const { POST } = await import("@/app/api/models/fallbacks/route");
    const req = new (jest.requireMock("next/server").NextRequest as new (
      url: string,
      init?: RequestInit,
    ) => NextRequest)("http://localhost/api/models/fallbacks/import", {
      method: "POST",
      body: JSON.stringify({ action: "import" }),
    });
    const res = (await POST(req)) as { status: number };
    expect(res.status).toBe(200);
    expect(mockUpdateBatch).toHaveBeenCalledWith({
      apiMaxRetries: 7,
      restorePrimaryOnFallback: false,
      fallbackNotification: true,
    });
    expect(mockSync).toHaveBeenCalledWith(
      expect.objectContaining({ apiMaxRetries: 7 }),
    );
  });

  it("returns 404 when config.yaml is missing", async () => {
    const missingRoot = join(tmpdir(), `ch-fb-missing-${Date.now()}`);
    mkdirSync(missingRoot, { recursive: true });
    fakeRoot = missingRoot;
    const { POST } = await import("@/app/api/models/fallbacks/route");
    const req = new (jest.requireMock("next/server").NextRequest as new (
      url: string,
      init?: RequestInit,
    ) => NextRequest)("http://localhost/api/models/fallbacks/import", {
      method: "POST",
      body: JSON.stringify({ action: "import" }),
    });
    const res = (await POST(req)) as { status: number };
    expect(res.status).toBe(404);
    expect(existsSync(join(missingRoot, "config.yaml"))).toBe(false);
  });
});
