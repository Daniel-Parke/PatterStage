/** @jest-environment node */

// T-0187: exercise both .env.local bridge entry points as separate processes.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

type Loader = "node" | "bash";

const scratchRoot = resolve(process.cwd(), "tmp");
const bash = process.platform === "win32" && existsSync("C:/Program Files/Git/bin/bash.exe")
  ? "C:/Program Files/Git/bin/bash.exe"
  : "bash";

function runLoader(loader: Loader, contents: string, selectedKey: string, expectedValue: string) {
  mkdirSync(scratchRoot, { recursive: true });
  const fixture = mkdtempSync(join(scratchRoot, "t0187-bridge-"));
  const fixtureArg = relative(process.cwd(), fixture).replaceAll("\\", "/");
  const environment = { ...process.env };
  for (const key of ["CH_READ_ONLY", "PS_READ_ONLY", "CH_REQUEST_SIGNING_SECRET", "PS_REQUEST_SIGNING_SECRET"]) {
    delete environment[key];
  }

  try {
    writeFileSync(join(fixture, ".env.local"), contents, "utf8");
    const nodeScript = [
      'import { loadEnvLocal } from "./scripts/tooling/_env-local.mjs";',
      "loadEnvLocal(process.argv[1]);",
      "loadEnvLocal(process.argv[1]);",
      "if (process.env[process.argv[2]] !== process.argv[3]) process.exitCode = 21;",
      'else console.log("bridge-ok");',
    ].join("\n");
    const bashScript = [
      "source scripts/lib/ps-dotenv-local.sh",
      'ps_load_patterstage_env_local "$1"',
      'ps_load_patterstage_env_local "$1"',
      'key="$2"',
      '[[ "${!key}" == "$3" ]] || exit 21',
      "printf 'bridge-ok\\n'",
    ].join("\n");
    const command = loader === "node" ? process.execPath : bash;
    const args = loader === "node"
      ? ["--input-type=module", "-e", nodeScript, fixtureArg, selectedKey, expectedValue]
      : ["-c", bashScript, "--", fixtureArg, selectedKey, expectedValue];
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

function expectOneKeyOnlyWarning(lines: string[], legacyKey: string, canonicalKey: string, value: string) {
  expect(lines.join("\n")).not.toContain(value);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain(legacyKey);
  expect(lines[0]).toContain(canonicalKey);
}

describe.each<Loader>(["node", "bash"])("T-0187 %s .env.local bridge warning", (loader) => {
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
