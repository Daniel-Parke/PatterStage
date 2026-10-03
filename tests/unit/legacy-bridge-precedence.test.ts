/** @jest-environment node */

// T-0187: reviewer counterexamples for the two .env.local bridge entry points.
import { runLegacyEnvLoader, type LegacyEnvLoader } from "../helpers/legacy-env-loader";

type Selection = "data-directory" | "read-only-empty";

function runLoader(loader: LegacyEnvLoader, contents: string, selection: Selection, expectedValue: string): string[] {
  return runLegacyEnvLoader(
    loader,
    contents,
    selection,
    expectedValue,
    ["CH_DATA_DIR", "PS_DATA_DIR", "CONTROL_HUB_DATA_DIR", "CH_READ_ONLY", "PS_READ_ONLY"],
    {
      nodeExpression: 'process.argv[2] === "data-directory"\n'
        + '  ? (process.env.PS_DATA_DIR || process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR || "")\n'
        + '  : (process.env.PS_READ_ONLY || process.env.CH_READ_ONLY || "").trim()',
      bashSelection: [
        'if [[ "$2" == "data-directory" ]]; then',
        '  selected="${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-}}}"',
        "else",
        '  selected="${PS_READ_ONLY:-${CH_READ_ONLY:-}}"',
        '  selected="${selected//[[:space:]]/}"',
        "fi",
      ].join("\n"),
    },
  );
}

describe.each<LegacyEnvLoader>(["node", "bash"])("T-0187 %s .env.local bridge precedence", (loader) => {
  it("warns once when CH_DATA_DIR wins over a later empty PS_DATA_DIR", () => {
    const lines = runLoader(loader, "CH_DATA_DIR=review-dir\nPS_DATA_DIR=\n", "data-directory", "review-dir");
    expect(lines.join("\n")).not.toContain("review-dir");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("CH_DATA_DIR");
    expect(lines[0]).toContain("PS_DATA_DIR");
  });

  it("does not warn when CH_READ_ONLY contains only whitespace", () => {
    const lines = runLoader(loader, "CH_READ_ONLY=   \n", "read-only-empty", "");
    expect(lines).toEqual([]);
  });
});

it("T-0187 node .env.local bridge precedence keeps an explicit PS_DATA_DIR without warning", () => {
  const lines = runLoader("node", "CH_DATA_DIR=review-dir\nPS_DATA_DIR=chosen-dir\n", "data-directory", "chosen-dir");
  expect(lines).toEqual([]);
});
