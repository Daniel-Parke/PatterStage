// ═══════════════════════════════════════════════════════════════
// hermes-providers.test.ts — Verify provider registry completeness
// ═══════════════════════════════════════════════════════════════

import {
  HERMES_PROVIDERS,
  PROVIDER_ENV_VAR,
  isHermesProvider,
  envVarForProvider,
} from "@/lib/hermes-providers";

describe("HERMES_PROVIDERS", () => {
  it("includes 'nous' as a valid provider", () => {
    expect(HERMES_PROVIDERS).toContain("nous");
  });

  it("recognises 'nous' via isHermesProvider", () => {
    expect(isHermesProvider("nous")).toBe(true);
  });
});

describe("PROVIDER_ENV_VAR", () => {
  it("maps 'nous' to empty string (OAuth-only, no env var)", () => {
    expect(PROVIDER_ENV_VAR["nous"]).toBe("");
  });

  it("has non-empty env vars for all non-OAuth providers", () => {
    const oauthOnly = new Set(["nous"]);
    for (const provider of HERMES_PROVIDERS) {
      if (oauthOnly.has(provider)) {
        expect(PROVIDER_ENV_VAR[provider]).toBe("");
      } else {
        expect(PROVIDER_ENV_VAR[provider]).not.toBe("");
        expect(PROVIDER_ENV_VAR[provider]).toMatch(/^[A-Z_]*_API_KEY$/);
      }
    }
  });

  it("has entries for all providers", () => {
    for (const provider of HERMES_PROVIDERS) {
      expect(PROVIDER_ENV_VAR[provider]).toBeDefined();
    }
  });
});

describe("envVarForProvider", () => {
  it("returns empty string for nous", () => {
    expect(envVarForProvider("nous")).toBe("");
  });

  it("returns correct env var for known providers", () => {
    expect(envVarForProvider("minimax")).toBe("MINIMAX_API_KEY");
    expect(envVarForProvider("anthropic")).toBe("ANTHROPIC_API_KEY");
    expect(envVarForProvider("openrouter")).toBe("OPENROUTER_API_KEY");
  });
});
