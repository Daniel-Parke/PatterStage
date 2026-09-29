/** @jest-environment node */

// T-0187: compare each warning with the value an actual app consumer uses.
import { captureLegacyBoot } from "../helpers/legacy-boot-fixture";

jest.mock("@/lib/host/paths", () => ({
  ...jest.requireActual("@/lib/host/paths"), shadowedDataWarning: () => null,
}));
jest.mock("@/lib/api/api-auth", () => ({
  ...jest.requireActual("@/lib/api/api-auth"),
  requireAuthenticatedHostWrites: () => null,
}));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory runs before imports.
jest.mock("@/lib/db", () => require("../helpers/mocks").dbMock());
const mockPullProfile = jest.fn((..._args: unknown[]) => ({ success: true, slug: "qa", backupPath: null, error: null }));
jest.mock("@/modules/hermes/lib/profile-pull", () => ({ pullProfileFromHermes: (...args: unknown[]) => mockPullProfile(...args) }));

type Consumer = "deploy" | "read-only" | "branch" | "reconcile" | "llm" | "origins";
const savedEnvironment = { ...process.env };
const keys = [
  "CH_ENABLE_DEPLOY_API", "PS_ENABLE_DEPLOY_API", "CH_READ_ONLY", "PS_READ_ONLY",
  "CH_UPDATE_GIT_BRANCH", "PS_UPDATE_GIT_BRANCH", "CH_PULL_RECONCILE_DISK", "PS_PULL_RECONCILE_DISK",
  "CONTROL_HUB_LLM_API", "PS_LLM_API", "CH_ALLOWED_DEV_ORIGINS", "PS_ALLOWED_DEV_ORIGINS",
  "CH_DATA_DIR", "PS_DATA_DIR", "CH_REQUEST_SIGNING_SECRET", "PS_REQUEST_SIGNING_SECRET",
] as const;

async function consumerResult(consumer: Consumer): Promise<unknown> {
  switch (consumer) {
    case "deploy": return (await import("@/lib/api/api-auth")).isDeployApiEnabled();
    case "read-only": return (await import("@/lib/api/read-only")).isReadOnly();
    case "branch": return (await import("@/lib/update-handlers/shared")).UPDATE_BRANCH;
    case "llm": return (await import("@/modules/hermes/lib/agent-runtime")).getAgentLlmEndpoints();
    case "origins": return (await import("../../next.config")).default.allowedDevOrigins;
    case "reconcile": {
      mockPullProfile.mockClear();
      const { NextRequest } = await import("next/server");
      const { POST } = await import("@/app/api/agent/profiles/sync/pull/route");
      const response = await POST(new NextRequest("http://localhost/api/agent/profiles/sync/pull", {
        method: "POST", body: JSON.stringify({ slug: "qa" }),
      }));
      expect(response.status).toBe(200);
      expect(mockPullProfile).toHaveBeenCalledTimes(1);
      return mockPullProfile.mock.calls[0][1];
    }
  }
}

async function bootAndRead(consumer: Consumer, legacyKey?: string, value?: string) {
  return captureLegacyBoot(savedEnvironment, keys, () => {
    if (legacyKey && value !== undefined) process.env[legacyKey] = value;
  }, () => consumerResult(consumer), { NODE_ENV: "production" });
}

describe("T-0187 effective app aliases", () => {
  it.each<[Consumer, string, string]>([
    ["deploy", "CH_ENABLE_DEPLOY_API", "bogus"],
    ["read-only", "CH_READ_ONLY", "bogus"],
    ["branch", "CH_UPDATE_GIT_BRANCH", ";;;"],
    ["reconcile", "CH_PULL_RECONCILE_DISK", "true"],
    ["llm", "CONTROL_HUB_LLM_API", "   "],
    ["origins", "CH_ALLOWED_DEV_ORIGINS", " , "],
  ])("%s uses its default and makes no selected-legacy claim for %s", async (consumer, key, value) => {
    const baseline = await bootAndRead(consumer);
    const actual = await bootAndRead(consumer, key, value);
    expect(actual.result).toEqual(baseline.result);
    expect(actual.warnings).toEqual([]);
  });

  it.each<[Consumer, string, string, unknown]>([
    ["deploy", "CH_ENABLE_DEPLOY_API", "true", true],
    ["read-only", "CH_READ_ONLY", "true", true],
    ["branch", "CH_UPDATE_GIT_BRANCH", "release/qa", "release/qa"],
  ])("%s keeps a valid %s value and warns once without its value", async (consumer, key, value, selected) => {
    const actual = await bootAndRead(consumer, key, value);
    expect(actual.result).toEqual(selected);
    expect(actual.warnings).toHaveLength(1);
    expect(actual.warnings[0]).toContain(key);
    expect(actual.warnings[0]).not.toContain(value);
    expect(actual.warnings[0]).not.toContain("\n");
  });
});
