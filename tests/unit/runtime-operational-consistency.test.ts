/** @jest-environment node */
import { dbSingletonMock, openBaselineDb } from "../helpers/baseline-db";

let mockDb: ReturnType<typeof openBaselineDb> | null = null;
// Boundary doubles prevent token, database, scheduler and provider side effects.
// Flag and gateway readers, diagnostics and register() remain real.
jest.mock("@/lib/host/paths", () => ({
  PS_DATA_DIR: "/owned/data", getDbPath: () => "/owned/data/test.db", shadowedDataWarning: () => null,
  readEnv: jest.requireActual<typeof import("@/lib/host/paths")>("@/lib/host/paths").readEnv,
}));
jest.mock("@/lib/api/api-auth", () => ({ isDeployApiEnabled: () => false, isReadOnly: () => false }));
jest.mock("@/lib/api/read-only", () => ({ isReadOnly: () => false }));
jest.mock("@/lib/api/auth-token", () => ({ getAuthMode: () => "token", ensureAuthToken: jest.fn(), describeTokenSource: () => ({ kind: "env" }) }));
jest.mock("@/lib/auth/boot-state", () => ({ initialiseBootState: jest.fn() }));
jest.mock("@/modules/hermes/lib/home", () => ({ selectedLegacyHermesHomeName: () => null, getHermesHome: () => "/owned/hermes" }));
jest.mock("@/lib/update-handlers/shared", () => ({ runGit: () => "owned-commit" }));
jest.mock("@/lib/db", () => dbSingletonMock(() => mockDb));
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
jest.mock("@/lib/orchestration", () => ({ ensureBackgroundScheduler: jest.fn() }));
jest.mock("@/lib/seed/catalog-seed", () => ({ ensureCatalogSeededOnce: jest.fn() }));
jest.mock("@/lib/laboratory/deep-research/research-repository", () => ({ failStuckResearchRuns: jest.fn(() => 1) }));
jest.mock("@/lib/chat/chat-repository", () => ({ failStuckChatMessages: jest.fn(() => 1) }));

import { describeOperationalFlags } from "@/lib/deploy/boot-diagnostics";
import { collectRuntimeStatus } from "@/lib/status/runtime-status";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getAgentLlmEndpoints } from "@/modules/hermes/lib/agent-runtime";
import { GET as runtimeStatusGET } from "@/app/api/status/runtime/route";
import { register } from "@/instrumentation";
import { ensureSyncLayer } from "@/lib/sync";
import { ensureBackgroundScheduler } from "@/lib/orchestration";
import { ensureCatalogSeededOnce } from "@/lib/seed/catalog-seed";
import { failStuckResearchRuns } from "@/lib/laboratory/deep-research/research-repository";
import { failStuckChatMessages } from "@/lib/chat/chat-repository";

const savedEnvironment = { ...process.env };
beforeEach(() => {
  mockDb = openBaselineDb();
  for (const key of Object.keys(process.env)) {
    if (/^(PS_|CH_|CONTROL_HUB_|HERMES_)/.test(key)) delete process.env[key];
  }
  process.env.NEXT_RUNTIME = "nodejs";
  jest.clearAllMocks();
  for (const step of [ensureSyncLayer, ensureBackgroundScheduler, ensureCatalogSeededOnce]) jest.mocked(step).mockReset();
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { mockDb?.close(); mockDb = null; process.env = { ...savedEnvironment }; jest.restoreAllMocks(); });

describe("T-0192 operational configuration matches consumers", () => {
  it.each(["0", "false", "no", "off", " OFF ", "true", "", "unset"])("reports Composer consistently for %j", value => {
    if (value !== "unset") process.env.PS_COMPOSER = value;
    const enabled = isFeatureEnabled("composer");
    expect(enabled).toBe(!["0", "false", "no", "off", " OFF "].includes(value));
    expect(collectRuntimeStatus({ hermesHome: "/owned/hermes" }).composerEnabled).toBe(enabled);
    expect(describeOperationalFlags()).toContain(`composer=${enabled ? "on" : "off"}`);
  });

  it.each([
    ["default", {}],
    ["explicit gateway", { HERMES_GATEWAY_URL: "http://127.0.0.1:9861" }],
    ["normalised gateway", { HERMES_GATEWAY_URL: " http://127.0.0.1:9861/ " }],
    ["primary LLM URL", { PS_LLM_API: "http://127.0.0.1:9862/v1/chat/completions" }],
    ["legacy LLM URL", { CONTROL_HUB_LLM_API: "http://127.0.0.1:9863/v1/chat/completions" }],
    ["explicit gateway precedence", { HERMES_GATEWAY_URL: "http://127.0.0.1:9861", PS_LLM_API: "http://127.0.0.1:9862/v1/chat/completions" }],
  ] as const)("reports the gateway actually used for %s", async (_name, environment) => {
    Object.assign(process.env, environment);
    const { gatewayBase } = getAgentLlmEndpoints();
    const response = await runtimeStatusGET();
    const status = await response.json();
    await register();
    const lines = jest.mocked(console.info).mock.calls.flatMap(args => args.filter((arg): arg is string => typeof arg === "string"));
    const configuration = lines.filter(line => line.startsWith("[config]") && line.includes("gateway="));
    expect(response.status).toBe(200);
    expect(status.data.gatewayUrl).toBe(gatewayBase);
    expect(configuration).toHaveLength(1);
    expect(/\bgateway=(\S+)/.exec(configuration[0])?.[1]).toBe(_name === "default" ? "default" : gatewayBase);
  });
});

describe("T-0192 boot recovery survives earlier boot failures", () => {
  it("recovers interrupted Research and Chat work on a healthy boot", async () => {
    await register();
    expect(ensureSyncLayer).toHaveBeenCalledTimes(1);
    expect(ensureBackgroundScheduler).toHaveBeenCalledTimes(1);
    expect(ensureCatalogSeededOnce).toHaveBeenCalledTimes(1);
    expect(failStuckResearchRuns).toHaveBeenCalledTimes(1);
    expect(failStuckChatMessages).toHaveBeenCalledTimes(1);
    for (const startup of [ensureSyncLayer, ensureBackgroundScheduler, ensureCatalogSeededOnce]) {
      for (const sweep of [failStuckResearchRuns, failStuckChatMessages]) {
        expect(jest.mocked(sweep).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(startup).mock.invocationCallOrder[0]);
      }
    }
  });

  it.each([
    ["sync", ensureSyncLayer], ["scheduler", ensureBackgroundScheduler], ["catalogue", ensureCatalogSeededOnce],
  ] as const)("still recovers after %s fails and does not silently swallow the failure", async (name, step) => {
    const failure = new Error(`Owned ${name} boot refusal`);
    jest.mocked(step).mockImplementationOnce(() => { throw failure; });
    let rejected: unknown;
    try { await register(); } catch (error) { rejected = error; }
    expect(rejected).toBe(failure);
    expect(failStuckResearchRuns).toHaveBeenCalledTimes(1);
    expect(failStuckChatMessages).toHaveBeenCalledTimes(1);
    const steps = [ensureSyncLayer, ensureBackgroundScheduler, ensureCatalogSeededOnce];
    const failedIndex = steps.indexOf(step);
    for (const [index, startup] of steps.entries()) {
      if (index > failedIndex) expect(startup).not.toHaveBeenCalled();
      else {
        expect(startup).toHaveBeenCalledTimes(1);
        for (const sweep of [failStuckResearchRuns, failStuckChatMessages]) {
          expect(jest.mocked(sweep).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(startup).mock.invocationCallOrder[0]);
        }
      }
    }
  });

  it("does not start Node boot work in the Edge runtime", async () => {
    process.env.NEXT_RUNTIME = "edge";
    await register();
    expect(ensureSyncLayer).not.toHaveBeenCalled();
    expect(failStuckResearchRuns).not.toHaveBeenCalled();
    expect(failStuckChatMessages).not.toHaveBeenCalled();
  });
});
