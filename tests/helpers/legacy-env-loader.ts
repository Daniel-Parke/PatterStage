import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export type LegacyEnvLoader = "node" | "bash";

type LoaderSelection = {
  nodeExpression: string;
  bashSelection: string;
};

const scratchRoot = resolve(process.cwd(), "tmp");
const bash = process.platform === "win32" && existsSync("C:/Program Files/Git/bin/bash.exe")
  ? "C:/Program Files/Git/bin/bash.exe"
  : "bash";

export function runLegacyEnvLoader(
  loader: LegacyEnvLoader,
  contents: string,
  selectionArgument: string,
  expectedValue: string,
  clearedEnvironmentKeys: readonly string[],
  selection: LoaderSelection,
): string[] {
  mkdirSync(scratchRoot, { recursive: true });
  const fixture = mkdtempSync(join(scratchRoot, "t0187-bridge-"));
  const fixtureArg = relative(process.cwd(), fixture).replaceAll("\\", "/");
  const environment = { ...process.env };
  for (const key of clearedEnvironmentKeys) delete environment[key];

  try {
    writeFileSync(join(fixture, ".env.local"), contents, "utf8");
    const nodeScript = [
      'import { loadEnvLocal } from "./scripts/tooling/_env-local.mjs";',
      "loadEnvLocal(process.argv[1]);",
      "loadEnvLocal(process.argv[1]);",
      `const selected = ${selection.nodeExpression};`,
      "if (selected !== process.argv[3]) process.exitCode = 21;",
      'else console.log("bridge-ok");',
    ].join("\n");
    const bashScript = [
      "source scripts/lib/ps-dotenv-local.sh",
      'ps_load_patterstage_env_local "$1"',
      'ps_load_patterstage_env_local "$1"',
      selection.bashSelection,
      '[[ "$selected" == "$3" ]] || exit 21',
      "printf 'bridge-ok\\n'",
    ].join("\n");
    const command = loader === "node" ? process.execPath : bash;
    const args = loader === "node"
      ? ["--input-type=module", "-e", nodeScript, fixtureArg, selectionArgument, expectedValue]
      : ["-c", bashScript, "--", fixtureArg, selectionArgument, expectedValue];
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
    // Only remove the unique fixture made beneath the repository's scratch root.
    if (fixture.startsWith(`${scratchRoot}${sep}`)) rmSync(fixture, { recursive: true, force: true });
  }
}
