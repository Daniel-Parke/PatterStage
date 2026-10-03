/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";

type Loader = "node" | "bash";
type DataKey = "CH_DATA_DIR" | "CONTROL_HUB_DATA_DIR";

const scratchRoot = resolve(process.cwd(), "tmp");
const bash = process.platform === "win32" && existsSync("C:/Program Files/Git/bin/bash.exe")
  ? "C:/Program Files/Git/bin/bash.exe"
  : "bash";

function runInherited(loader: Loader, winningKey: DataKey | "PS_DATA_DIR") {
  mkdirSync(scratchRoot, { recursive: true });
  const fixture = mkdtempSync(join(scratchRoot, "t0187-inherited-"));
  const environment = { ...process.env };
  for (const key of ["PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR"]) delete environment[key];
  const legacyPath = join(fixture, "review-legacy-dir");
  const olderPath = join(fixture, "older-control-hub-dir");
  const canonicalPath = join(fixture, "chosen-dir");
  if (winningKey === "CH_DATA_DIR" || winningKey === "PS_DATA_DIR") environment.CH_DATA_DIR = legacyPath;
  if (winningKey === "CONTROL_HUB_DATA_DIR" || winningKey === "PS_DATA_DIR") {
    environment.CONTROL_HUB_DATA_DIR = olderPath;
  }
  if (winningKey === "PS_DATA_DIR") environment.PS_DATA_DIR = canonicalPath;
  environment.HOME = fixture;
  environment.USERPROFILE = fixture;

  // Both consumers select from the inherited environment; no .env.local is created.
  const nodeScript = [
    'import { loadEnvLocal } from "./scripts/tooling/_env-local.mjs";',
    'import { resolveDataDir } from "./scripts/tooling/ps-deploy.mjs";',
    "loadEnvLocal(process.argv[1]);",
    "loadEnvLocal(process.argv[1]);",
    'console.log(`oracle-selected=${resolveDataDir()}`);',
  ].join("\n");
  const bashScript = [
    "source scripts/lib/ps-dotenv-local.sh",
    "source scripts/lib/ps-env.sh",
    'ps_load_patterstage_env_local "$1"',
    'ps_load_patterstage_env_local "$1"',
    'printf "oracle-selected=%s\\n" "$(ps_data_dir)"',
  ].join("\n");

  try {
    const result = loader === "node"
      ? spawnSync(process.execPath, ["--input-type=module", "-e", nodeScript, fixture], {
        cwd: process.cwd(), env: environment, encoding: "utf8", timeout: 10_000,
      })
      : spawnSync(bash, ["-c", bashScript, "--", fixture], {
        cwd: process.cwd(), env: environment, encoding: "utf8", timeout: 10_000,
      });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(Boolean);
    const selected = lines.filter((line) => line.startsWith("oracle-selected="));
    const warnings = lines.filter((line) => !line.startsWith("oracle-selected="));
    const expectedPath = winningKey === "PS_DATA_DIR" ? canonicalPath
      : winningKey === "CH_DATA_DIR" ? legacyPath : olderPath;
    expect(selected).toEqual([`oracle-selected=${expectedPath}`]);
    return { warnings, legacyPath, olderPath };
  } finally {
    if (fixture.startsWith(`${scratchRoot}${sep}`)) rmSync(fixture, { recursive: true, force: true });
  }
}

describe.each<Loader>(["node", "bash"])("T-0187 %s inherited data-directory provenance", (loader) => {
  it.each<DataKey>(["CH_DATA_DIR", "CONTROL_HUB_DATA_DIR"])(
    "warns once when inherited %s wins without .env.local",
    (key) => {
      const { warnings, legacyPath, olderPath } = runInherited(loader, key);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain(key);
      expect(warnings[0]).toContain("PS_DATA_DIR");
      expect(warnings[0]).not.toContain(legacyPath);
      expect(warnings[0]).not.toContain(olderPath);
      expect(warnings[0]).not.toContain("\n");
    },
  );

  it("keeps an inherited canonical directory and emits no legacy warning", () => {
    const { warnings } = runInherited(loader, "PS_DATA_DIR");
    expect(warnings).toEqual([]);
  });
});
