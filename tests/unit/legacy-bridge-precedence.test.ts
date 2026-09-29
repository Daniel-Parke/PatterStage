/** @jest-environment node */

// T-0187: reviewer counterexamples for the two .env.local bridge entry points.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

type Loader = "node" | "bash";
type Selection = "data-directory" | "read-only-empty";

const scratchRoot = resolve(process.cwd(), "tmp");
const bash = process.platform === "win32" && existsSync("C:/Program Files/Git/bin/bash.exe")
  ? "C:/Program Files/Git/bin/bash.exe"
  : "bash";

function runLoader(loader: Loader, contents: string, selection: Selection, expectedValue: string): string[] {
  mkdirSync(scratchRoot, { recursive: true });
  const fixture = mkdtempSync(join(scratchRoot, "t0187-precedence-"));
  const fixtureArg = relative(process.cwd(), fixture).replaceAll("\\", "/");
  const environment = { ...process.env };
  for (const key of ["CH_DATA_DIR", "PS_DATA_DIR", "CONTROL_HUB_DATA_DIR", "CH_READ_ONLY", "PS_READ_ONLY"]) {
    delete environment[key];
  }

  try {
    writeFileSync(join(fixture, ".env.local"), contents, "utf8");
    const nodeScript = [
      'import { loadEnvLocal } from "./scripts/tooling/_env-local.mjs";',
      "loadEnvLocal(process.argv[1]);",
      "loadEnvLocal(process.argv[1]);",
      'const selected = process.argv[2] === "data-directory"',
      '  ? (process.env.PS_DATA_DIR || process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR || "")',
      '  : (process.env.PS_READ_ONLY || process.env.CH_READ_ONLY || "").trim();',
      "if (selected !== process.argv[3]) process.exitCode = 21;",
      'else console.log("bridge-ok");',
    ].join("\n");
    const bashScript = [
      "source scripts/lib/ps-dotenv-local.sh",
      'ps_load_patterstage_env_local "$1"',
      'ps_load_patterstage_env_local "$1"',
      'if [[ "$2" == "data-directory" ]]; then',
      '  selected="${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-}}}"',
      "else",
      '  selected="${PS_READ_ONLY:-${CH_READ_ONLY:-}}"',
      '  selected="${selected//[[:space:]]/}"',
      "fi",
      '[[ "$selected" == "$3" ]] || exit 21',
      "printf 'bridge-ok\\n'",
    ].join("\n");
    const command = loader === "node" ? process.execPath : bash;
    const args = loader === "node"
      ? ["--input-type=module", "-e", nodeScript, fixtureArg, selection, expectedValue]
      : ["-c", bashScript, "--", fixtureArg, selection, expectedValue];
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      env: environment,
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(Boolean);
    expect(lines).toContain("bridge-ok");
    return lines.filter((line) => line !== "bridge-ok");
  } finally {
    // Remove only the fixture created under this repository's scratch root.
    if (fixture.startsWith(`${scratchRoot}${sep}`)) rmSync(fixture, { recursive: true, force: true });
  }
}

describe.each<Loader>(["node", "bash"])("T-0187 %s .env.local bridge precedence", (loader) => {
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
