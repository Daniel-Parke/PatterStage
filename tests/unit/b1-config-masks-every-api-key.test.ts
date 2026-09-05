/** @jest-environment node */
/**
 * B1 (T-0095), D74: GET /api/config masked `model.api_key` and
 * `auxiliary.<task>.api_key` and nothing else, so a key in
 * `fallback_providers[].api_key` (a shape the same file's own reader declares)
 * left the server in plaintext to anyone who called the endpoint instead of
 * loading the page.
 *
 * Two hand-listed shapes is a list, and a list is what drifts. The fix is a
 * walk: every value under a key that names an API key, at any depth, in any
 * array, is masked on the way out.
 */
const KEY = "sk-live-1234567890abcdef";

const mockReadCachedConfigResult = jest.fn();
jest.mock("@/lib/config-cache", () => ({
  readCachedConfigResult: () => mockReadCachedConfigResult(),
  readCachedConfig: () => mockReadCachedConfigResult().config,
}));
jest.mock("@/lib/runtime/workspace", () => ({
  getAgentWorkspace: () => ({ config: "/tmp/ps-test/config.yaml", backups: "/tmp/ps-test/backups" }),
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));

import { NextRequest } from "next/server";

import { maskApiKey, maskSecretsDeep } from "@/lib/secret-mask";

describe("maskSecretsDeep: every API key at any depth", () => {
  const config = {
    model: { default: "gpt", api_key: KEY },
    auxiliary: { vision: { model: "v", api_key: KEY }, summary: { model: "s" } },
    fallback_providers: [
      { provider: "openrouter", model: "a", api_key: KEY },
      { provider: "ollama", model: "b" },
    ],
    providers: { custom: { nested: { deeper: { api_key: KEY } } } },
    camel: { apiKey: KEY },
    agent: { name: "Bob", persona: "not a key, even with the word key in it: " + KEY.slice(0, 3) },
  };

  it("masks the three declared shapes and the ones nobody declared", () => {
    const masked = maskSecretsDeep(config) as typeof config;
    expect(masked.model.api_key).toBe(maskApiKey(KEY));
    expect(masked.auxiliary.vision.api_key).toBe(maskApiKey(KEY));
    expect(masked.fallback_providers[0].api_key).toBe(maskApiKey(KEY));
    expect(masked.providers.custom.nested.deeper.api_key).toBe(maskApiKey(KEY));
    expect(masked.camel.apiKey).toBe(maskApiKey(KEY));
  });

  it("leaves everything that is not a key alone, arrays and order included", () => {
    const masked = maskSecretsDeep(config) as typeof config;
    expect(masked.model.default).toBe("gpt");
    expect(masked.fallback_providers).toHaveLength(2);
    expect(masked.fallback_providers[1]).toEqual({ provider: "ollama", model: "b" });
    expect(masked.agent.name).toBe("Bob");
    expect(Object.keys(masked)).toEqual(Object.keys(config));
  });

  it("does not mutate what it was given", () => {
    maskSecretsDeep(config);
    expect(config.model.api_key).toBe(KEY);
    expect(config.fallback_providers[0].api_key).toBe(KEY);
  });

  it("skips empty and non-string values rather than inventing a mask for them", () => {
    const masked = maskSecretsDeep({ model: { api_key: "" }, other: { api_key: 42 } }) as {
      model: { api_key: string };
      other: { api_key: number };
    };
    expect(masked.model.api_key).toBe("");
    expect(masked.other.api_key).toBe(42);
  });
});

describe("GET /api/config never hands a fallback-provider key to the browser", () => {
  it("masks the key the old two-branch walker missed", async () => {
    mockReadCachedConfigResult.mockReturnValue({
      config: {
        model: { default: "gpt", api_key: KEY },
        fallback_providers: [{ provider: "openrouter", model: "a", api_key: KEY }],
      },
      error: null,
    });
    const { GET } = await import("@/app/api/config/route");
    const res = await GET(new NextRequest("http://localhost/api/config"));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(KEY);
    expect(text).toContain(maskApiKey(KEY));
  });
});
