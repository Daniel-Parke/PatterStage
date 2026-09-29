/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type Loader = "node" | "bash";

const repository = process.cwd();
const bash = process.platform === "win32" && existsSync("C:/Program Files/Git/bin/bash.exe")
  ? "C:/Program Files/Git/bin/bash.exe"
  : "bash";

function isolatedEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (key.startsWith("CH_") || key.startsWith("PS_") || key === "CONTROL_HUB_DATA_DIR") {
      delete environment[key];
    }
  }
  return environment;
}

function outputLines(stdout: string, stderr: string): string[] {
  return `${stdout}\n${stderr}`.split(/\r?\n/).filter(Boolean);
}

function runBranchLoader(loader: Loader, fileBranch?: string): { selected: string; warnings: string[] } {
  const fixture = mkdtempSync(join(tmpdir(), "t0187-branch-provenance-"));
  const environment = isolatedEnvironment();
  environment.CH_UPDATE_GIT_BRANCH = "inherited-review-branch";
  if (fileBranch !== undefined) {
    writeFileSync(join(fixture, ".env.local"), `CH_UPDATE_GIT_BRANCH=${fileBranch}\n`, "utf8");
  }

  const nodeScript = [
    'import { loadEnvLocal } from "./scripts/tooling/_env-local.mjs";',
    "loadEnvLocal(process.argv[1]);",
    "loadEnvLocal(process.argv[1]);",
    // ps-deploy.mjs selects this environment value or its default before update.
    'console.log(`oracle-selected=${process.env.PS_UPDATE_GIT_BRANCH || "dev"}`);',
  ].join("\n");
  const bashScript = [
    "set -e",
    "source scripts/lib/ps-dotenv-local.sh",
    'ps_load_patterstage_env_local "$1"',
    'ps_load_patterstage_env_local "$1"',
    "node -e 'console.log(`oracle-selected=${process.env.PS_UPDATE_GIT_BRANCH || \"dev\"}`)'",
  ].join("\n");

  try {
    const result = loader === "node"
      ? spawnSync(process.execPath, ["--input-type=module", "-e", nodeScript, fixture], {
        cwd: repository, env: environment, encoding: "utf8", timeout: 10_000,
      })
      : spawnSync(bash, ["-c", bashScript, "--", fixture], {
        cwd: repository, env: environment, encoding: "utf8", timeout: 10_000,
      });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const lines = outputLines(result.stdout, result.stderr);
    const selected = lines.filter((line) => line.startsWith("oracle-selected="));
    expect(selected).toHaveLength(1);
    return {
      selected: selected[0].slice("oracle-selected=".length),
      warnings: lines.filter((line) => !line.startsWith("oracle-selected=")),
    };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

function isolatedDashboardBlock(): string {
  const source = readFileSync(resolve(repository, "scripts/bootstrap/setup-hindsight.sh"), "utf8")
    .replaceAll("\r\n", "\n");
  const start = source.indexOf("\nPS_WEB_PORT=");
  const end = source.indexOf('\necho "Useful commands:"', start);
  if (start < 0 || end <= start) throw new Error("Hindsight dashboard block boundaries changed");
  const block = source.slice(start + 1, end);
  const lines = block.split("\n").filter(Boolean);
  // This is a safety boundary, not a source-spelling assertion. Never run an
  // expanded block if installer or service commands enter the extracted range.
  if (lines.length > 16 || lines.some((line) => !/^\s*(?:PS_WEB_PORT=|_p=|if \[|\[ -n|fi$|warn "CONTROL_HUB_PORT|echo )/.test(line))) {
    throw new Error("Hindsight dashboard block is no longer safe to isolate");
  }
  return block;
}

function runDashboardPort(inheritedScratch?: string, filePort?: string): { port: string; warnings: string[] } {
  const fixture = mkdtempSync(join(tmpdir(), "t0187-port-provenance-"));
  const environment = isolatedEnvironment();
  environment.CONTROL_HUB_PORT = "4387";
  if (inheritedScratch !== undefined) environment._p = inheritedScratch;
  else delete environment._p;
  if (filePort !== undefined) writeFileSync(join(fixture, ".env.local"), `PORT=${filePort}\n`, "utf8");
  const script = [
    "set -e",
    'warn() { printf "oracle-warning=%s\\n" "$1"; }',
    'REPO_ROOT="$1"',
    isolatedDashboardBlock(),
  ].join("\n");

  try {
    const result = spawnSync(bash, ["-c", script, "--", fixture], {
      cwd: repository, env: environment, encoding: "utf8", timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const lines = outputLines(result.stdout, result.stderr);
    const dashboard = lines.filter((line) => line.includes("Memory page at http://localhost:"));
    expect(dashboard).toHaveLength(1);
    return {
      port: dashboard[0].match(/localhost:(\d+)\/memory/)?.[1] ?? "",
      warnings: lines.filter((line) => line.startsWith("oracle-warning=")),
    };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe.each<Loader>(["node", "bash"])("T-0187 %s branch provenance", (loader) => {
  it("keeps inherited CH_UPDATE_GIT_BRANCH out of a missing-file deploy default warning", () => {
    const { selected, warnings } = runBranchLoader(loader);
    expect(selected).toBe("dev");
    expect(warnings).toEqual([]);
  });

  it("warns once when file-supplied CH_UPDATE_GIT_BRANCH selects the deploy branch", () => {
    const { selected, warnings } = runBranchLoader(loader, "release/oracle");
    expect(selected).toBe("release/oracle");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("CH_UPDATE_GIT_BRANCH");
    expect(warnings[0]).toContain("PS_UPDATE_GIT_BRANCH");
    expect(warnings[0]).not.toContain("release/oracle");
  });
});

describe("T-0187 Hindsight dashboard port provenance", () => {
  it("warns when inherited CONTROL_HUB_PORT wins despite unrelated inherited _p", () => {
    const { port, warnings } = runDashboardPort("stale-unrelated-value");
    expect(port).toBe("4387");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("CONTROL_HUB_PORT");
    expect(warnings[0]).toContain("PORT");
    expect(warnings[0]).not.toContain("4387");
  });

  it("warns when inherited CONTROL_HUB_PORT wins with no inherited _p", () => {
    const { port, warnings } = runDashboardPort();
    expect(port).toBe("4387");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("CONTROL_HUB_PORT");
  });

  it("uses file PORT and emits no legacy warning", () => {
    const { port, warnings } = runDashboardPort("stale-unrelated-value", "5391");
    expect(port).toBe("5391");
    expect(warnings).toEqual([]);
  });
});
