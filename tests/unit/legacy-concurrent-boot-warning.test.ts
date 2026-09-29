/** @jest-environment node */

import { resetLegacyBootEnvironment } from "../helpers/legacy-boot-fixture";

// T-0187: exercise concurrent calls to the actual Node boot entrypoint.
jest.mock("@/modules/hermes/lib/home", () => ({ selectedLegacyHermesHomeName: () => null }));
jest.mock("@/lib/host/paths", () => ({ shadowedDataWarning: () => null }));

const savedEnvironment = { ...process.env };
const selectionKeys = [
  "PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR", "PS_SCRIPTS_DIR", "CH_SCRIPTS_DIR",
  "PS_HARDWARE_LOG_DIR", "CH_HARDWARE_LOG_DIR", "PS_ENABLE_DEPLOY_API", "CH_ENABLE_DEPLOY_API",
  "PS_REQUEST_SIGNING_SECRET", "CH_REQUEST_SIGNING_SECRET", "PS_READ_ONLY", "CH_READ_ONLY",
  "PS_RUN_MAX_MINUTES", "CH_RUN_MAX_MINUTES", "PS_UPDATE_GIT_BRANCH", "CH_UPDATE_GIT_BRANCH",
  "PS_PULL_RECONCILE_DISK", "CH_PULL_RECONCILE_DISK", "PS_LLM_API", "CONTROL_HUB_LLM_API",
  "PS_ALLOWED_DEV_ORIGINS", "CH_ALLOWED_DEV_ORIGINS", "HERMES_HOME", "AGENT_HOME",
] as const;

let warn: jest.SpyInstance;
let info: jest.SpyInstance;
let error: jest.SpyInstance;

beforeEach(() => {
  resetLegacyBootEnvironment(savedEnvironment, selectionKeys);
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  info = jest.spyOn(console, "info").mockImplementation(() => {});
  error = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  info.mockRestore();
  error.mockRestore();
  process.env = { ...savedEnvironment };
});

function warningLines(): string[] {
  return warn.mock.calls.map((call: unknown[]) => call.map(String).join(" "));
}

async function expectTwoCompleteBoots(): Promise<void> {
  const { initialiseBootState } = await import("@/lib/auth/boot-state");
  const { ensureSyncLayer } = await import("@/lib/sync");
  const { ensureBackgroundScheduler } = await import("@/lib/orchestration");
  const { ensureCatalogSeededOnce } = await import("@/lib/seed/catalog-seed");
  expect(initialiseBootState).toHaveBeenCalledTimes(2);
  expect(ensureSyncLayer).toHaveBeenCalledTimes(2);
  expect(ensureBackgroundScheduler).toHaveBeenCalledTimes(2);
  expect(ensureCatalogSeededOnce).toHaveBeenCalledTimes(2);
}

function expectOneKeyOnlyWarning(): void {
  const lines = warningLines();
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain("CH_READ_ONLY → PS_READ_ONLY");
  expect(lines[0]).not.toContain("true");
  expect(lines[0]).not.toContain("\n");
}

describe("T-0187 concurrent legacy boot warning", () => {
  it("warns once for a winning CH_READ_ONLY when two Node registrations run concurrently", async () => {
    process.env.CH_READ_ONLY = "true";
    const { register } = await import("@/instrumentation");

    const results = await Promise.allSettled([register(), register()]);

    expect(results).toEqual([
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined },
    ]);
    await expectTwoCompleteBoots();
    expectOneKeyOnlyWarning();
  });

  it("warns once for sequential Node registrations with the same winning legacy value", async () => {
    process.env.CH_READ_ONLY = "true";
    const { register } = await import("@/instrumentation");

    await register();
    await register();

    await expectTwoCompleteBoots();
    expectOneKeyOnlyWarning();
  });

  it("does not warn when PS_READ_ONLY alone supplies two concurrent Node boots", async () => {
    process.env.PS_READ_ONLY = "true";
    const { register } = await import("@/instrumentation");

    const results = await Promise.allSettled([register(), register()]);

    expect(results).toEqual([
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined },
    ]);
    await expectTwoCompleteBoots();
    expect(warningLines()).toEqual([]);
  });
});
