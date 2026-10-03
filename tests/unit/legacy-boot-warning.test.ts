/** @jest-environment node */

// T-0187: exercise the public boot entrypoint while isolating unrelated work.
import { resetLegacyBootEnvironment } from "../helpers/legacy-boot-fixture";

jest.mock("@/lib/host/paths", () => ({ shadowedDataWarning: () => null }));

const originalEnvironment = { ...process.env };
const testKeys = [
  "CH_READ_ONLY", "PS_READ_ONLY", "CH_REQUEST_SIGNING_SECRET", "PS_REQUEST_SIGNING_SECRET",
  "CONTROL_HUB_DATA_DIR", "CH_DATA_DIR", "PS_DATA_DIR", "AGENT_HOME", "HERMES_HOME",
] as const;
let warnings: jest.SpyInstance;
let info: jest.SpyInstance;
let errors: jest.SpyInstance;

async function boot(times = 1): Promise<string[]> {
  const { register } = await import("@/instrumentation");
  for (let attempt = 0; attempt < times; attempt += 1) await register();
  return warnings.mock.calls.map((call: unknown[]) => call.map(String).join(" "));
}

function expectSelectedLegacyWarning(lines: string[], legacyKey: string, replacement: string, value: string): void {
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain(legacyKey);
  expect(lines[0]).toContain(replacement);
  expect(lines[0]).not.toContain(value);
  expect(lines[0]).not.toContain("\n");
}

beforeEach(() => {
  resetLegacyBootEnvironment(originalEnvironment, testKeys);
  warnings = jest.spyOn(console, "warn").mockImplementation(() => {});
  info = jest.spyOn(console, "info").mockImplementation(() => {});
  errors = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnings.mockRestore();
  info.mockRestore();
  errors.mockRestore();
  process.env = { ...originalEnvironment };
});

describe("T-0187 legacy boot warning", () => {
  it("warns once for a winning CH_ value across repeated Node registrations and continues boot", async () => {
    process.env.CH_READ_ONLY = "true";

    const lines = await boot(2);

    expectSelectedLegacyWarning(lines, "CH_READ_ONLY", "PS_READ_ONLY", "true");
    const { ensureSyncLayer } = await import("@/lib/sync");
    expect(ensureSyncLayer).toHaveBeenCalledTimes(2);
  });

  it("warns for a winning CONTROL_HUB_ directory without printing its path", async () => {
    const privatePath = "C:/oracle/private-data-directory";
    process.env.CONTROL_HUB_DATA_DIR = privatePath;

    expectSelectedLegacyWarning(await boot(), "CONTROL_HUB_DATA_DIR", "PS_DATA_DIR", privatePath);
  });

  it("warns for a winning AGENT_HOME alias without printing its path", async () => {
    const privatePath = "C:/oracle/private-hermes-home";
    process.env.AGENT_HOME = privatePath;

    expectSelectedLegacyWarning(await boot(), "AGENT_HOME", "HERMES_HOME", privatePath);
  });

  it("warns for a winning legacy signing secret without printing the secret", async () => {
    const secret = "oracle-secret-shaped-signing-value-1234567890";
    process.env.CH_REQUEST_SIGNING_SECRET = secret;

    expectSelectedLegacyWarning(await boot(), "CH_REQUEST_SIGNING_SECRET", "PS_REQUEST_SIGNING_SECRET", secret);
  });

  it("does not warn when a canonical key wins over a different legacy value", async () => {
    process.env.PS_READ_ONLY = "false";
    process.env.CH_READ_ONLY = "true";

    expect(await boot()).toHaveLength(0);
  });

  it("does not warn when canonical and legacy keys contain the same value", async () => {
    process.env.PS_DATA_DIR = "C:/oracle/same-directory";
    process.env.CONTROL_HUB_DATA_DIR = process.env.PS_DATA_DIR;

    expect(await boot()).toHaveLength(0);
  });

  it("uses the legacy fallback when the canonical directory value is blank", async () => {
    const privatePath = "C:/oracle/blank-canonical-fallback";
    process.env.PS_DATA_DIR = "";
    process.env.CONTROL_HUB_DATA_DIR = privatePath;

    expectSelectedLegacyWarning(await boot(), "CONTROL_HUB_DATA_DIR", "PS_DATA_DIR", privatePath);
  });

  it("does not warn for a PS-only Node boot", async () => {
    process.env.PS_READ_ONLY = "true";
    process.env.PS_DATA_DIR = "C:/oracle/canonical-directory";

    expect(await boot()).toHaveLength(0);
  });

  it("does not warn or start Node services during Edge boot", async () => {
    process.env.NEXT_RUNTIME = "edge";
    process.env.CH_READ_ONLY = "true";

    expect(await boot()).toHaveLength(0);
    const { ensureSyncLayer } = await import("@/lib/sync");
    expect(ensureSyncLayer).not.toHaveBeenCalled();
  });
});
