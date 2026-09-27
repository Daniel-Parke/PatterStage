/** @jest-environment node */

import { spawnSync } from "node:child_process";
import {
  appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0163-bootstrap-credentials-";
const KEY = "fixture-only-T0163-private-key";
const HERMES_OLD = `# Hermes comment\nAPI_SERVER_KEY=${KEY}\nKEEP_HERMES=yes\n`;
const LOCAL_OLD = "# PatterStage comment\nPS_ENABLE_DEPLOY_API=false\nKEEP_LOCAL=yes\n";
const IS_POSIX = process.platform === "linux" || process.platform === "darwin";

type Event = { action: "create" | "read" | "child"; path?: string; mode?: number; command?: string };
type Fixture = { root: string; repo: string; hermes: string; local: string; events: Event[]; run: ReturnType<typeof spawnSync> };

function dispose(root: string): void {
  const actual = realpathSync(root);
  if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
    throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
  }
  rmSync(actual, { recursive: true, force: true });
}

function checkMode(path: string): void {
  expect(existsSync(path)).toBe(true);
  if (IS_POSIX) expect(statSync(path).mode & 0o777).toBe(0o600);
}

function existing(path: string, text: string): void {
  writeFileSync(path, text);
  if (IS_POSIX) {
    chmodSync(path, 0o666);
    expect(statSync(path).mode & 0o777).toBe(0o666);
  }
}

const NODE_PRELOAD = String.raw`
  const fs = require('node:fs');
  const cp = require('node:child_process');
  const path = require('node:path');
  const events = [];
  const root = fs.realpathSync(process.env.ORACLE_ROOT);
  const eventFile = process.env.ORACLE_EVENTS;
  const realWrite = fs.writeFileSync;
  const realAppend = fs.appendFileSync;
  const realOpen = fs.openSync;
  const realCopy = fs.copyFileSync;
  const realRead = fs.readFileSync;
  const realChmod = fs.chmodSync;
  const canonical = p => {
    if (typeof p !== 'string') return null;
    const absolute = path.resolve(p);
    try { return fs.realpathSync(absolute); }
    catch (error) {
      if (error.code !== 'ENOENT') return null;
      try { return path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute)); }
      catch { return null; }
    }
  };
  const sensitive = p => {
    const resolved = canonical(p);
    if (!resolved) return null;
    const inside = path.relative(root, resolved);
    if (!inside || inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)) return null;
    return path.basename(resolved).startsWith('.env') || inside.split(path.sep).includes('backups') ? resolved : null;
  };
  const record = (p, absent) => {
    const resolved = sensitive(p);
    if (absent && resolved && fs.existsSync(p))
      events.push({action:'create', path:resolved, mode:fs.statSync(p).mode & 0o777});
  };
  process.umask(0);
  fs.writeFileSync = (...args) => {
    const absent = typeof args[0] === 'string' && !fs.existsSync(args[0]);
    const value = realWrite(...args);
    record(args[0], absent);
    return value;
  };
  fs.appendFileSync = (...args) => {
    const absent = typeof args[0] === 'string' && !fs.existsSync(args[0]);
    const value = realAppend(...args);
    record(args[0], absent);
    return value;
  };
  fs.openSync = (...args) => {
    const absent = typeof args[0] === 'string' && !fs.existsSync(args[0]);
    const fd = realOpen(...args);
    const resolved = sensitive(args[0]);
    if (absent && resolved)
      events.push({action:'create', path:resolved, mode:fs.fstatSync(fd).mode & 0o777});
    return fd;
  };
  fs.copyFileSync = (...args) => {
    const absent = typeof args[1] === 'string' && !fs.existsSync(args[1]);
    const value = realCopy(...args);
    record(args[1], absent);
    return value;
  };
  fs.readFileSync = (...args) => {
    const resolved = sensitive(args[0]);
    if (resolved && fs.existsSync(args[0]))
      events.push({action:'read', path:resolved, mode:fs.statSync(args[0]).mode & 0o777});
    return realRead(...args);
  };
  fs.chmodSync = (...args) => {
    if (process.env.ORACLE_DENY_CHMOD === '1' && sensitive(args[0]))
      throw Object.assign(new Error('permission denied'), {code:'EACCES'});
    return realChmod(...args);
  };
  if (process.env.ORACLE_OUTSIDE) {
    fs.writeFileSync(process.env.ORACLE_OUTSIDE, 'fixture-only-outside');
    fs.readFileSync(process.env.ORACLE_OUTSIDE);
  }
  cp.spawnSync = (command, args = []) => {
    events.push({action:'child', command:[command, ...args].join(' ')});
    return {status:0, stdout:'', stderr:''};
  };
  process.on('exit', () => realWrite(eventFile, JSON.stringify(events)));
  require('node:module').syncBuiltinESMExports();
`;

function setupRoot(tempBase = tmpdir()): { root: string; repo: string; hermes: string; data: string; local: string } {
  const root = mkdtempSync(join(tempBase, PREFIX));
  const repo = join(root, "repo");
  const hermes = join(root, "hermes");
  const data = join(root, "data");
  mkdirSync(repo);
  mkdirSync(hermes);
  mkdirSync(data);
  writeFileSync(join(hermes, "config.yaml"), "model: fixture-only\n");
  return { root, repo, hermes, data, local: join(repo, ".env.local") };
}

function nodeSetup(present: boolean, denyChmod = false, tempBase?: string): Fixture {
  const f = setupRoot(tempBase);
  const eventFile = join(f.root, "node-events.json");
  const preload = join(f.root, "node-preload.cjs");
  try {
    for (const source of [
      "scripts/bootstrap/setup.mjs", "scripts/bootstrap/env-local.mjs", "scripts/tooling/_platform.mjs",
    ]) {
      const target = join(f.repo, source);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(ROOT, source), target);
    }
    if (present) {
      existing(join(f.hermes, ".env"), HERMES_OLD);
      existing(f.local, LOCAL_OLD);
    }
    writeFileSync(preload, NODE_PRELOAD);
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
    for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    Object.assign(env, {
      NODE_OPTIONS: "",
      HOME: f.root, APPDATA: f.root, LOCALAPPDATA: f.root,
      HERMES_HOME: f.hermes, PS_DATA_DIR: f.data, CH_DATA_DIR: f.data,
      CONTROL_HUB_DATA_DIR: f.data, PORT: "47328",
      ORACLE_ROOT: f.root, ORACLE_EVENTS: eventFile,
      ORACLE_DENY_CHMOD: denyChmod ? "1" : "0",
    });
    if (tempBase) {
      env.TMPDIR = tempBase;
      env.ORACLE_OUTSIDE = join(dirname(tempBase), ".env");
    }
    const run = spawnSync(process.execPath, ["--require", preload, join(f.repo, "scripts", "bootstrap", "setup.mjs")], {
      cwd: f.repo,
      env,
      encoding: "utf8", timeout: 30_000, windowsHide: true,
    });
    if (run.error || run.signal || !existsSync(eventFile)) {
      throw new Error(`INFRASTRUCTURE: Node setup did not reach the disposable preload (${run.error?.message ?? run.signal ?? run.status})`);
    }
    const events = JSON.parse(readFileSync(eventFile, "utf8")) as Event[];
    if (!events.some((event) => event.action === "child") && !denyChmod) {
      throw new Error("INFRASTRUCTURE: Node setup never reached a stubbed external command");
    }
    return { root: f.root, repo: f.repo, hermes: f.hermes, local: f.local, events, run };
  } catch (error) {
    dispose(f.root);
    throw error;
  }
}

function bashExecutable(): string {
  const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
  return process.platform === "win32" && existsSync(gitBash) ? gitBash : "bash";
}

function shellPath(path: string): string {
  if (process.platform !== "win32") return path;
  const result = spawnSync(bashExecutable(), ["-c", "cygpath -u \"$1\"", "oracle", path], { encoding: "utf8" });
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error("INFRASTRUCTURE: Git Bash could not map a disposable fixture path");
  }
  return result.stdout.trim();
}

const FAKE_NODE = `#!/usr/bin/env bash\nif [ "$1" = -v ]; then echo v20.0.0; elif [ "$1" = -e ]; then echo ${KEY}; fi\n`;
const FAKE_NPM = "#!/usr/bin/env bash\nprintf 'npm\\n' >> \"$ORACLE_EVENTS\"\nexit 0\n";
const FAKE_NPX = "#!/usr/bin/env bash\nprintf 'npx\\n' >> \"$ORACLE_EVENTS\"\nexit 0\n";

function shellSetup(present: boolean, denyChmod = false): Fixture {
  const f = setupRoot();
  const bin = join(f.root, "bin");
  const eventFile = join(f.root, "shell-events.txt");
  const denialFile = join(f.root, "chmod-denied.txt");
  try {
    for (const source of ["scripts/bootstrap/setup.sh", "scripts/lib/ps-env.sh", "scripts/lib/ps-dotenv-local.sh"]) {
      const target = join(f.repo, source);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(ROOT, source), target);
    }
    // Installation is external to the credential path. Keep the real dotenv
    // helpers, but make that unrelated install step inert in the fixture.
    appendFileSync(join(f.repo, "scripts", "lib", "ps-env.sh"), "\nps_noninteractive_install() { return 0; }\n");
    for (const [name, content] of [
      ["ps-port.sh", "ps_setup_port_and_dev_origins() { PS_SELECTED_PORT=47329; }\n"],
      ["ps-log.sh", "# disposable fixture\n"],
      ["ps-migrate.sh", "ps_migrate_run() { printf 'migration\\n' >> \"$ORACLE_EVENTS\"; }\n"],
    ]) writeFileSync(join(f.repo, "scripts", "lib", name), content);
    mkdirSync(bin);
    for (const [name, content] of [["node", FAKE_NODE], ["npm", FAKE_NPM], ["npx", FAKE_NPX]]) {
      const target = join(bin, name);
      writeFileSync(target, content);
      chmodSync(target, 0o755);
    }
    if (denyChmod && IS_POSIX) {
      const target = join(bin, "chmod");
      writeFileSync(target, "#!/usr/bin/env bash\ncase \"$*\" in *'.env'*) printf 'denied\\n' > \"$ORACLE_CHMOD_DENIED\"; exit 13;; esac\nexec /usr/bin/chmod \"$@\"\n");
      chmodSync(target, 0o755);
    }
    if (present) {
      existing(join(f.hermes, ".env"), HERMES_OLD);
      existing(f.local, LOCAL_OLD);
    }
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
    for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    env.PATH = `${shellPath(bin)}${process.platform === "win32" ? ";" : ":"}${env.PATH ?? ""}`;
    env.HOME = shellPath(f.root);
    env.HERMES_HOME = shellPath(f.hermes);
    env.PS_DATA_DIR = shellPath(f.data);
    env.CH_DATA_DIR = env.PS_DATA_DIR;
    env.CONTROL_HUB_DATA_DIR = env.PS_DATA_DIR;
    env.APPDATA = env.HOME;
    env.LOCALAPPDATA = env.HOME;
    env.ORACLE_EVENTS = shellPath(eventFile);
    env.ORACLE_CHMOD_DENIED = shellPath(denialFile);
    env.PS_INSTALL_NONINTERACTIVE = "1";
    env.PS_SETUP_RUN_TESTS = "0";
    env.CI = "false";
    const run = spawnSync(bashExecutable(), ["-c", "umask 000; bash \"$1\"", "oracle", shellPath(join(f.repo, "scripts", "bootstrap", "setup.sh"))], {
      cwd: f.repo, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000, windowsHide: true,
    });
    const earlyRefusal = denyChmod && IS_POSIX && existsSync(denialFile);
    if (run.error || run.signal || (!existsSync(eventFile) && !earlyRefusal)) {
      const diagnostic = (run.stderr ?? "").replaceAll(KEY, "<redacted>").replaceAll(f.root, "<fixture>").slice(-800);
      throw new Error(`INFRASTRUCTURE: shell setup did not reach stubbed commands (${run.error?.message ?? run.signal ?? run.status}): ${diagnostic}`);
    }
    const events: Event[] = existsSync(eventFile)
      ? readFileSync(eventFile, "utf8").trim().split("\n").map((command) => ({ action: "child", command }))
      : [];
    return { root: f.root, repo: f.repo, hermes: f.hermes, local: f.local, events, run };
  } catch (error) {
    dispose(f.root);
    throw error;
  }
}

function inspectFixture(f: Fixture, assertion: () => void): void {
  try { assertion(); } finally { dispose(f.root); }
}

describe("T-0163 credential files at both public setup entries", () => {
  const symlinkTest = IS_POSIX ? it : it.skip;
  symlinkTest("Node setup records first writes and prior reads under a symlinked TMPDIR", () => {
    const aliasRoot = mkdtempSync(join(tmpdir(), `${PREFIX}alias-`));
    const linkedTmp = join(aliasRoot, "linked-tmp");
    try {
      symlinkSync(tmpdir(), linkedTmp, "dir");
      for (const present of [false, true]) {
        const f = nodeSetup(present, false, linkedTmp);
        inspectFixture(f, () => {
          expect(f.run.status).toBe(0);
          for (const path of [join(f.hermes, ".env"), f.local]) {
            checkMode(path);
            const action = present ? "read" : "create";
            const events = f.events.filter((event) => event.action === action && event.path === realpathSync(path));
            expect(events.length).toBeGreaterThan(0);
            expect(events.map((event) => event.mode)).toEqual(events.map(() => 0o600));
          }
          expect(f.events.some((event) => event.path === realpathSync(join(aliasRoot, ".env")))).toBe(false);
        });
      }
    } finally {
      dispose(aliasRoot);
    }
  });

  it("Node setup creates both credential dotenv files private from their first write", () => {
    const f = nodeSetup(false);
    inspectFixture(f, () => {
      expect(f.run.status).toBe(0);
      checkMode(join(f.hermes, ".env"));
      checkMode(f.local);
      if (IS_POSIX) {
        for (const path of [join(f.hermes, ".env"), f.local]) {
          const created = f.events.filter((event) => event.action === "create" && event.path === realpathSync(path));
          expect(created.length).toBeGreaterThan(0);
          expect(created.map((event) => event.mode)).toEqual(created.map(() => 0o600));
        }
      }
    });
  });

  it("Node setup narrows existing public dotenv files before it reads or appends", () => {
    const f = nodeSetup(true);
    inspectFixture(f, () => {
      expect(f.run.status).toBe(0);
      checkMode(join(f.hermes, ".env"));
      checkMode(f.local);
      expect(readFileSync(join(f.hermes, ".env"), "utf8")).toContain(HERMES_OLD);
      expect(readFileSync(f.local, "utf8")).toContain(LOCAL_OLD);
      if (IS_POSIX) {
        for (const path of [join(f.hermes, ".env"), f.local]) {
          const reads = f.events.filter((event) => event.action === "read" && event.path === realpathSync(path));
          expect(reads.length).toBeGreaterThan(0);
          expect(reads.map((event) => event.mode)).toEqual(reads.map(() => 0o600));
        }
      }
    });
  });

  it("Node setup fails without printing credentials when an existing file cannot be secured", () => {
    const f = nodeSetup(true, true);
    inspectFixture(f, () => {
      if (IS_POSIX) {
        expect(f.run.status).not.toBe(0);
        expect(f.run.stdout).not.toContain("Setup Complete!");
        expect(`${f.run.stdout}\n${f.run.stderr}`).not.toContain(KEY);
      } else {
        expect(f.run.status).toBe(0);
      }
    });
  });

  it("Git Bash/POSIX setup creates both dotenv files privately under umask 000", () => {
    const f = shellSetup(false);
    inspectFixture(f, () => {
      expect(f.run.status).toBe(0);
      checkMode(join(f.hermes, ".env"));
      checkMode(f.local);
      expect(`${f.run.stdout}\n${f.run.stderr}`).not.toContain(KEY);
    });
  });

  it("Git Bash/POSIX setup narrows public files and retains comments and keys", () => {
    const f = shellSetup(true);
    inspectFixture(f, () => {
      expect(f.run.status).toBe(0);
      checkMode(join(f.hermes, ".env"));
      checkMode(f.local);
      expect(readFileSync(join(f.hermes, ".env"), "utf8")).toContain(HERMES_OLD);
      expect(readFileSync(f.local, "utf8")).toContain(LOCAL_OLD);
    });
  });

  it("POSIX setup fails closed and never prints a key if a public file cannot be secured", () => {
    const f = shellSetup(true, true);
    inspectFixture(f, () => {
      if (IS_POSIX) {
        expect(f.run.status).not.toBe(0);
        expect(f.run.stdout).not.toContain("Setup Complete!");
        expect(`${f.run.stdout}\n${f.run.stderr}`).not.toContain(KEY);
      } else {
        expect(f.run.status).toBe(0);
      }
    });
  });
});
