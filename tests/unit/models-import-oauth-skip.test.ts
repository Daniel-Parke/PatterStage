/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// OAuth-only providers are skipped at the composition point, not in the store.
//
// The skip used to live inside credentials-repository.upsertCredential, which
// inferred "this provider has no API key" from whether HERMES had an env-var
// name for it. That is a vendor question asked inside a core repository over a
// column that is plain `TEXT NOT NULL` with no CHECK.
//
// It now lives in POST /api/models/import, which is app/ and may consult the
// module. Behaviour is unchanged, which is the point of this test: `nous` is
// still never written, and every other provider still is.
// ═══════════════════════════════════════════════════════════════

const mockUpsertCredential = jest.fn();
jest.mock("@/lib/credentials-repository", () => ({
  upsertCredential: (...a: unknown[]) => mockUpsertCredential(...a),
  listCredentials: () => [],
}));

const mockParsed = {
  models: [] as unknown[],
  credentials: [] as Array<{ provider: string; apiKey: string }>,
  details: [] as string[],
};
jest.mock("@/modules/hermes/lib/config-import", () => ({
  parseHermesConfig: () => mockParsed,
}));

jest.mock("@/lib/models-repository", () => ({
  upsertModel: jest.fn(() => ({ id: "m1", action: "inserted" })),
  listModels: jest.fn(() => []),
  updateModel: jest.fn(() => ({ id: "m1" })),
  setModelCredential: jest.fn(),
}));
jest.mock("@/lib/api-auth", () => ({ requireAuth: () => null, requireNotReadOnly: () => null }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/db", () => ({ ensureDb: jest.fn(), getDb: jest.fn() }));

import { NextRequest } from "next/server";

async function importPost() {
  const { POST } = await import("@/app/api/models/import/route");
  return POST(
    new NextRequest("http://localhost/api/models/import", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParsed.models = [];
  mockParsed.credentials = [];
  mockParsed.details = [];
  mockUpsertCredential.mockImplementation((c: { provider: string }) => ({ id: `c_${c.provider}` }));
});

describe("POST /api/models/import skips OAuth-only providers", () => {
  it("never stores a credential for nous", async () => {
    // `nous` carries an empty env-var name in Hermes' table: the documented
    // sentinel for "OAuth only, no key exists".
    mockParsed.credentials = [{ provider: "nous", apiKey: "no-key-needed" }];

    await importPost();

    expect(mockUpsertCredential).not.toHaveBeenCalled();
  });

  it("stores credentials for API-key providers", async () => {
    mockParsed.credentials = [{ provider: "openrouter", apiKey: "sk-abc" }];

    await importPost();

    expect(mockUpsertCredential).toHaveBeenCalledWith({
      provider: "openrouter",
      apiKey: "sk-abc",
    });
  });

  it("skips only the OAuth one when both are present", async () => {
    mockParsed.credentials = [
      { provider: "nous", apiKey: "x" },
      { provider: "anthropic", apiKey: "sk-ant" },
    ];

    await importPost();

    expect(mockUpsertCredential).toHaveBeenCalledTimes(1);
    expect(mockUpsertCredential).toHaveBeenCalledWith({ provider: "anthropic", apiKey: "sk-ant" });
  });

  it("skips a provider Hermes does not recognise at all", async () => {
    // envVarForProvider returns null for unknown providers too, and importing a
    // key for a provider the agent cannot use would be a silent dead row.
    mockParsed.credentials = [{ provider: "not-a-real-provider", apiKey: "k" }];

    await importPost();

    expect(mockUpsertCredential).not.toHaveBeenCalled();
  });
});
