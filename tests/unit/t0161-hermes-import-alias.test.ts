/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const TOOLING = join(ROOT, "scripts", "tooling");
const CLI = join(TOOLING, "hermes-registry-import.mjs");
const PREFIX = "t0161-hermes-alias-";

function run(script: string, args: string[], root: string, dataDir: string, hermesHome: string) {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    NODE_OPTIONS: "",
    HOME: root,
    USERPROFILE: root,
    APPDATA: root,
    LOCALAPPDATA: root,
    PS_DATA_DIR: dataDir,
    CH_DATA_DIR: dataDir,
    CONTROL_HUB_DATA_DIR: dataDir,
    HERMES_HOME: hermesHome,
  };
  for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
    windowsHide: true,
  });
}

function removeDirectoryAlias(path: string): void {
  if (process.platform === "win32") rmdirSync(path);
  else unlinkSync(path);
}

describe("T-0161 Hermes registry import CLI rejects an absent database through an alias", () => {
  it("reports database not found when invoked through a second spelling of the same file", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    const dataDir = join(root, "data");
    const hermesHome = join(root, "hermes");
    const realProbeDir = join(root, "real-probe");
    const probeAlias = join(root, "probe-alias");
    const toolingAlias = join(root, "tooling-alias");
    const missingDb = join(dataDir, "missing.db");
    let madeProbeAlias = false;
    let madeToolingAlias = false;
    try {
      mkdirSync(dataDir);
      mkdirSync(hermesHome);
      mkdirSync(realProbeDir);
      writeFileSync(join(realProbeDir, "identity.mjs"),
        "import { fileURLToPath } from 'node:url'; process.stdout.write(JSON.stringify({ modulePath: fileURLToPath(import.meta.url), argvPath: process.argv[1] }));\n");
      try {
        symlinkSync(realProbeDir, probeAlias, process.platform === "win32" ? "junction" : "dir");
        madeProbeAlias = true;
        symlinkSync(TOOLING, toolingAlias, process.platform === "win32" ? "junction" : "dir");
        madeToolingAlias = true;
      } catch (error) {
        throw new Error(`INFRASTRUCTURE: path alias creation failed (${String(error)})`);
      }
      if (realpathSync(toolingAlias) !== realpathSync(TOOLING) ||
          realpathSync(join(toolingAlias, "hermes-registry-import.mjs")) !== realpathSync(CLI)) {
        throw new Error("INFRASTRUCTURE: CLI alias does not resolve to the expected file");
      }

      const identity = run(join(probeAlias, "identity.mjs"), [], root, dataDir, hermesHome);
      if (identity.error || identity.signal || identity.status !== 0) {
        throw new Error(`INFRASTRUCTURE: identity probe could not run (${identity.error?.message ?? identity.signal ?? identity.status})`);
      }
      let paths: { modulePath: string; argvPath: string };
      try {
        paths = JSON.parse(identity.stdout) as { modulePath: string; argvPath: string };
      } catch {
        throw new Error("INFRASTRUCTURE: identity probe did not report Node paths");
      }
      if (paths.modulePath === paths.argvPath || realpathSync(paths.modulePath) !== realpathSync(paths.argvPath)) {
        throw new Error("INFRASTRUCTURE: Node did not report two spellings of the same module");
      }

      const direct = run(CLI, [missingDb], root, dataDir, hermesHome);
      if (direct.error || direct.signal) {
        throw new Error(`INFRASTRUCTURE: direct CLI could not launch (${direct.error?.message ?? direct.signal})`);
      }
      if (direct.status === 0 || !/Database not found:/i.test(direct.stderr)) {
        throw new Error(`INFRASTRUCTURE: missing-database control did not reach the CLI (${direct.status})`);
      }

      const aliased = run(join(toolingAlias, "hermes-registry-import.mjs"), [missingDb], root, dataDir, hermesHome);
      if (aliased.error || aliased.signal) {
        throw new Error(`INFRASTRUCTURE: aliased CLI could not launch (${aliased.error?.message ?? aliased.signal})`);
      }
      expect({
        exitedNonZero: aliased.status !== 0,
        databaseNotFound: /Database not found:/i.test(aliased.stderr),
        missingDatabaseCreated: existsSync(missingDb),
        stackTrace: /\n\s+at\s+\S+/.test(aliased.stderr),
      }).toEqual({ exitedNonZero: true, databaseNotFound: true, missingDatabaseCreated: false, stackTrace: false });
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      if (madeToolingAlias) removeDirectoryAlias(toolingAlias);
      if (madeProbeAlias) removeDirectoryAlias(probeAlias);
      rmSync(actual, { recursive: true, force: true });
    }
  });
});
