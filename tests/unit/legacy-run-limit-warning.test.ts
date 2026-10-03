/** @jest-environment node */

// T-0187: the warning must describe the limit the app actually uses.
import { runLegacyEnvLoader, type LegacyEnvLoader } from "../helpers/legacy-env-loader";
import { captureLegacyBoot } from "../helpers/legacy-boot-fixture";

jest.mock("@/lib/host/paths", () => ({ shadowedDataWarning: () => null }));

const originalEnvironment = { ...process.env };
const submittedAt = "2026-09-29T12:00:00.000Z";
const privatePath = "C:/oracle/private-run-data";
const privateToken = "oracle-private-run-token-1234567890";
const clearedKeys = [
  "CH_RUN_MAX_MINUTES", "PS_RUN_MAX_MINUTES",
  "CH_DATA_DIR", "PS_DATA_DIR",
  "CH_REQUEST_SIGNING_SECRET", "PS_REQUEST_SIGNING_SECRET",
] as const;

async function appDeadlineAndWarnings(legacyValue: string): Promise<{ minutes: number; warnings: string[] }> {
  const { result: minutes, warnings } = await captureLegacyBoot(originalEnvironment, clearedKeys, () => {
    process.env.CH_RUN_MAX_MINUTES = legacyValue;
    process.env.PS_DATA_DIR = privatePath;
    process.env.PS_REQUEST_SIGNING_SECRET = privateToken;
  }, async () => {
    const { runDeadline, GRACE_MINUTES } = await import("@/lib/orchestration/run-deadline");
    const deadline = runDeadline(submittedAt, null);
    expect(deadline).not.toBeNull();
    return (Date.parse(deadline!.at) - Date.parse(submittedAt)) / 60_000 - GRACE_MINUTES;
  });
  return { minutes, warnings };
}

function expectSafeWarning(warnings: string[], value: string): void {
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("CH_RUN_MAX_MINUTES");
  expect(warnings[0]).toContain("PS_RUN_MAX_MINUTES");
  expect(warnings[0]).not.toContain(value);
  expect(warnings[0]).not.toContain(privatePath);
  expect(warnings[0]).not.toContain(privateToken);
  expect(warnings[0]).not.toContain("\n");
}

describe("T-0187 effective app run limit and warning", () => {
  it("uses 120 minutes and emits no selected-legacy warning for invalid CH_RUN_MAX_MINUTES", async () => {
    const result = await appDeadlineAndWarnings("invalid");
    expect(result.minutes).toBe(120);
    expect(result.warnings).toEqual([]);
  });

  it("uses 120 minutes and emits no selected-legacy warning for zero CH_RUN_MAX_MINUTES", async () => {
    const result = await appDeadlineAndWarnings("0");
    expect(result.minutes).toBe(120);
    expect(result.warnings).toEqual([]);
  });

  it("uses a valid legacy limit and warns once without disclosing values", async () => {
    const result = await appDeadlineAndWarnings("37");
    expect(result.minutes).toBe(37);
    expectSafeWarning(result.warnings, "37");
  });
});

function bridgeWarnings(loader: LegacyEnvLoader, legacyValue: string): string[] {
  // These processes verify that the old name still bridges. Only the app test
  // above evaluates the actual mission deadline.
  return runLegacyEnvLoader(
    loader,
    `CH_RUN_MAX_MINUTES=${legacyValue}\nPS_DATA_DIR=${privatePath}\nPS_REQUEST_SIGNING_SECRET=${privateToken}\n`,
    "PS_RUN_MAX_MINUTES",
    legacyValue,
    clearedKeys,
    { nodeExpression: "process.env.PS_RUN_MAX_MINUTES", bashSelection: 'selected="${PS_RUN_MAX_MINUTES:-}"' },
  );
}

describe.each<LegacyEnvLoader>(["node", "bash"])("T-0187 %s .env.local run-limit bridge warning", (loader) => {
  it("bridges invalid CH_RUN_MAX_MINUTES without a selected-legacy warning", () => {
    expect(bridgeWarnings(loader, "invalid")).toEqual([]);
  });

  it("bridges zero CH_RUN_MAX_MINUTES without a selected-legacy warning", () => {
    expect(bridgeWarnings(loader, "0")).toEqual([]);
  });

  it("bridges a valid legacy limit and warns once without disclosing values", () => {
    expectSafeWarning(bridgeWarnings(loader, "37"), "37");
  });
});
