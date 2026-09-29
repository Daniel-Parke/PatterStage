/** @jest-environment node */

// T-0187: exercise both .env.local bridge entry points as separate processes.
import { runLegacyEnvLoader, type LegacyEnvLoader } from "../helpers/legacy-env-loader";

function runLoader(loader: LegacyEnvLoader, contents: string, selectedKey: string, expectedValue: string) {
  return runLegacyEnvLoader(
    loader,
    contents,
    selectedKey,
    expectedValue,
    ["CH_READ_ONLY", "PS_READ_ONLY", "CH_REQUEST_SIGNING_SECRET", "PS_REQUEST_SIGNING_SECRET"],
    { nodeExpression: "process.env[process.argv[2]]", bashSelection: 'key="$2"\nselected="${!key}"' },
  );
}

function expectOneKeyOnlyWarning(lines: string[], legacyKey: string, canonicalKey: string, value: string) {
  expect(lines.join("\n")).not.toContain(value);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain(legacyKey);
  expect(lines[0]).toContain(canonicalKey);
}

describe.each<LegacyEnvLoader>(["node", "bash"])("T-0187 %s .env.local bridge warning", (loader) => {
  it("warns once across two loads when CH_READ_ONLY supplies PS_READ_ONLY", () => {
    const lines = runLoader(loader, "CH_READ_ONLY=true\n", "PS_READ_ONLY", "true");
    expectOneKeyOnlyWarning(lines, "CH_READ_ONLY", "PS_READ_ONLY", "true");
  });

  it("warns without disclosing a winning legacy signing secret", () => {
    const secret = "oracle-secret-shaped-signing-value-1234567890";
    const lines = runLoader(loader, `CH_REQUEST_SIGNING_SECRET=${secret}\n`, "PS_REQUEST_SIGNING_SECRET", secret);
    expectOneKeyOnlyWarning(lines, "CH_REQUEST_SIGNING_SECRET", "PS_REQUEST_SIGNING_SECRET", secret);
  });

  it("keeps an explicit PS_READ_ONLY value and emits no warning", () => {
    const lines = runLoader(loader, "CH_READ_ONLY=1\nPS_READ_ONLY=0\n", "PS_READ_ONLY", "0");
    expect(lines).toEqual([]);
  });
});
