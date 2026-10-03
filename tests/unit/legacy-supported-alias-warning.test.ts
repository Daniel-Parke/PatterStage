/** @jest-environment node */

import { runLegacyEnvLoader, type LegacyEnvLoader } from "../helpers/legacy-env-loader";

const clearedKeys = [
  "CH_DATA_DIR", "PS_DATA_DIR", "CONTROL_HUB_DATA_DIR",
  "CH_NO_SUPPORTED_READER", "PS_NO_SUPPORTED_READER",
  "CH_READ_ONLY", "PS_READ_ONLY",
] as const;

function runLoader(
  loader: LegacyEnvLoader,
  contents: string,
  expectedValue: string,
  nodeExpression: string,
  bashSelection: string,
): string[] {
  return runLegacyEnvLoader(
    loader,
    contents,
    "PS_DATA_DIR",
    expectedValue,
    clearedKeys,
    { nodeExpression, bashSelection },
  );
}

describe.each<LegacyEnvLoader>(["node", "bash"])("T-0187 %s supported-alias warnings", (loader) => {
  it("keeps a whitespace canonical directory selected and does not warn for CH_DATA_DIR", () => {
    // The script readers accept a whitespace string as a present canonical value.
    const lines = runLoader(
      loader,
      "CH_DATA_DIR=legacy-dir\nPS_DATA_DIR=   \n",
      "   ",
      "process.env.PS_DATA_DIR || process.env.CH_DATA_DIR",
      'selected="${PS_DATA_DIR:-${CH_DATA_DIR:-}}"',
    );

    expect(lines).toEqual([]);
  });

  it("bridges an unsupported CH_ name without warning", () => {
    const lines = runLoader(
      loader,
      "CH_NO_SUPPORTED_READER=unused\n",
      "unused",
      "process.env.PS_NO_SUPPORTED_READER",
      'selected="${PS_NO_SUPPORTED_READER:-}"',
    );

    expect(lines).toEqual([]);
  });

  it("warns once when the supported CH_READ_ONLY alias supplies PS_READ_ONLY", () => {
    const lines = runLoader(
      loader,
      "CH_READ_ONLY=true\n",
      "true",
      "process.env.PS_READ_ONLY",
      'selected="${PS_READ_ONLY:-}"',
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("CH_READ_ONLY");
    expect(lines[0]).toContain("PS_READ_ONLY");
    expect(lines[0]).not.toContain("true");
  });
});
