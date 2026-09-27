/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-shell-seed-";

function bashExecutable(): string {
  if (process.platform === "win32") {
    const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
    if (existsSync(gitBash)) return gitBash;
  }
  return "bash";
}

function shellPath(nativePath: string): string {
  if (process.platform !== "win32") return nativePath;
  const result = spawnSync(bashExecutable(), ["-c", "cygpath -u \"$1\"", "oracle", nativePath], { encoding: "utf8" });
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`INFRASTRUCTURE: Git Bash could not map a fixture path (${result.error?.message ?? result.status})`);
  }
  return result.stdout.trim();
}

function shellFixture(root: string, selected: "explicit" | "legacy", dropHermesConfigDuringMigration = false) {
  const repo = join(root, "repo");
  const bootstrap = join(repo, "scripts", "bootstrap");
  const lib = join(repo, "scripts", "lib");
  const bin = join(root, "bin");
  const home = join(root, "home");
  const events = join(root, "events.txt");
  const selectedDir = selected === "explicit" ? join(root, "chosen-data") : join(home, "control-hub", "data");
  mkdirSync(bootstrap, { recursive: true });
  mkdirSync(lib, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(home, { recursive: true });
  mkdirSync(selectedDir, { recursive: true });
  if (dropHermesConfigDuringMigration) {
    mkdirSync(join(home, ".hermes"), { recursive: true });
    writeFileSync(join(home, ".hermes", "config.yaml"), "model:\n  default: anthropic/disposable-model\n");
  }
  writeFileSync(join(bootstrap, "setup.sh"), readFileSync(join(ROOT, "scripts", "bootstrap", "setup.sh"), "utf8").replace(/\r\n/g, "\n"));
  writeFileSync(join(lib, "ps-env.sh"), [
    "ps_noninteractive_install() { return 0; }",
    "ps_env_set() { :; }",
    "ps_env_set_if_absent() { :; }",
    "ps_print_hermes_install_paths() { :; }",
  ].join("\n") + "\n");
  writeFileSync(join(lib, "ps-dotenv-local.sh"), "ps_load_patterstage_env_local() { :; }\n");
  writeFileSync(join(lib, "ps-port.sh"), "ps_setup_port_and_dev_origins() { PS_SELECTED_PORT=42069; }\n");
  writeFileSync(join(lib, "ps-log.sh"), "# disposable fixture\n");
  writeFileSync(join(lib, "ps-migrate.sh"), [
    "ps_migrate_run() {",
    "  printf 'schema:%s\\n' \"$2\" >> \"$ORACLE_EVENTS\"",
    "  if [ \"${ORACLE_DROP_HERMES_CONFIG:-}\" = 1 ]; then",
    "    [ -f \"$HERMES_HOME/config.yaml\" ] && printf 'config:present-at-migration\\n' >> \"$ORACLE_EVENTS\"",
    "    rm -f \"$HERMES_HOME/config.yaml\"",
    "    printf 'config:removed\\n' >> \"$ORACLE_EVENTS\"",
    "  fi",
    "}",
  ].join("\n") + "\n");
  writeFileSync(join(bin, "node"), "#!/bin/sh\nif [ \"$1\" = '-v' ]; then echo v20.0.0; elif [ \"$1\" = '-e' ]; then echo disposable-key; fi\n");
  writeFileSync(join(bin, "npm"), "#!/bin/sh\nexit 0\n");
  writeFileSync(join(bin, "npx"), [
    "#!/bin/sh",
    "case \"$*\" in",
    "  *seed-catalog.ts*) printf 'catalog:%s\\n' \"${PS_DATA_DIR:-<unset>}\" >> \"$ORACLE_EVENTS\" ;;",
    "esac",
  ].join("\n") + "\n");
  for (const name of ["node", "npm", "npx"]) chmodSync(join(bin, name), 0o755);

  const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  env.PATH = `${shellPath(bin)}${process.platform === "win32" ? ";" : ":"}${env.PATH ?? ""}`;
  env.HOME = shellPath(home);
  env.HERMES_HOME = shellPath(join(home, ".hermes"));
  env.ORACLE_EVENTS = shellPath(events);
  env.PS_INSTALL_NONINTERACTIVE = "1";
  env.CI = "false";
  if (dropHermesConfigDuringMigration) env.ORACLE_DROP_HERMES_CONFIG = "1";
  if (selected === "explicit") env.PS_DATA_DIR = shellPath(selectedDir);

  const run = spawnSync(bashExecutable(), [shellPath(join(bootstrap, "setup.sh"))], {
    cwd: repo, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000, windowsHide: true,
  });
  if (run.error || run.signal || run.status === null || (!dropHermesConfigDuringMigration && run.status !== 0)) {
    throw new Error(`INFRASTRUCTURE: disposable setup did not complete (${run.error?.message ?? run.signal ?? run.status}); ${run.stderr.slice(-800)}`);
  }
  if (!existsSync(events)) throw new Error("INFRASTRUCTURE: setup emitted no migration or seed events");
  const lines = readFileSync(events, "utf8").trim().split("\n");
  if (!dropHermesConfigDuringMigration &&
      (lines.length !== 2 || !lines[0].startsWith("schema:") || !lines[1].startsWith("catalog:"))) {
    throw new Error(`INFRASTRUCTURE: setup did not reach both steps (${lines.join(", ")})`);
  }
  if (dropHermesConfigDuringMigration &&
      (!existsSync(join(home, ".hermes", ".env")) || !lines[0].startsWith("schema:") ||
       !lines.includes("config:present-at-migration") || !lines.includes("config:removed") ||
       existsSync(join(home, ".hermes", "config.yaml")))) {
    throw new Error("INFRASTRUCTURE: configured setup did not reach the config-removing migration fixture");
  }
  return { lines, selectedDir: shellPath(selectedDir), status: run.status };
}

describe("T-0161 shell setup seeds the selected database directory", () => {
  it.each(["explicit", "legacy"] as const)("passes the %s selected directory from migration to catalog seed", (selected) => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const { lines, selectedDir } = shellFixture(root, selected);
      expect(lines).toEqual([`schema:${selectedDir}`, `catalog:${selectedDir}`]);
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });

  it("stops configured setup if Hermes config disappears during migration", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const { lines, status } = shellFixture(root, "explicit", true);
      expect({ exitedNonZero: status !== 0, catalogStarted: lines.some((line) => line.startsWith("catalog:")) })
        .toEqual({ exitedNonZero: true, catalogStarted: false });
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });
});
