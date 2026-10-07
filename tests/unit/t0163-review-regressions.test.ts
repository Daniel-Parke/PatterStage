/** @jest-environment node */
/* load runtime after setting the disposable Hermes root */

import { spawnSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const fs = require("node:fs") as typeof import("node:fs");
const REPO = join(__dirname, "..", "..");
const PREFIX = "t0163-review-regressions-";
const OLD = "# retained\nOPENROUTER_API_KEY=fixture-old\nKEEP=yes\n";
const NEW_KEY = "fixture-new-private-key";
const POSIX = process.platform === "linux" || process.platform === "darwin";

jest.mock("@/modules/hermes/lib/agent-runtime", () => require("../helpers/mocks").agentRuntimeFakeRootMock());

function mode(path: string): number {
  return fs.statSync(path).mode & 0o777;
}

function dispose(root: string): void {
  const actual = fs.realpathSync(root);
  if (dirname(actual) !== fs.realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
    throw new Error("INFRASTRUCTURE: fixture escaped the temporary directory");
  }
  fs.rmSync(actual, { recursive: true, force: true });
}

function createRoot(): string {
  return fs.mkdtempSync(join(tmpdir(), PREFIX));
}

const NODE_PRELOAD = String.raw`
  const fs = require('node:fs');
  const cp = require('node:child_process');
  const path = require('node:path');
  const realRead = fs.readFileSync;
  const realWrite = fs.writeFileSync;
  const realAppend = fs.appendFileSync;
  const realOpen = fs.openSync;
  const events = [];
  const home = process.env.HERMES_HOME;
  const local = path.join(process.env.ORACLE_REPO, '.env.local');
  const capture = (action, p) => {
    if (p === path.join(home, '.env') || p === local)
      events.push({action, path:p, homeMode:fs.existsSync(home) ? fs.statSync(home).mode & 0o777 : null});
  };
  process.umask(0);
  fs.readFileSync = (...args) => { capture('read', args[0]); return realRead(...args); };
  fs.writeFileSync = (...args) => { capture('write', args[0]); return realWrite(...args); };
  fs.appendFileSync = (...args) => { capture('append', args[0]); return realAppend(...args); };
  fs.openSync = (...args) => { capture('open', args[0]); return realOpen(...args); };
  cp.spawnSync = () => { events.push({action:'child'}); return {status:0, stdout:'', stderr:''}; };
  process.on('exit', () => realWrite(process.env.ORACLE_EVENTS, JSON.stringify(events)));
  require('node:module').syncBuiltinESMExports();
`;

type SetupEvent = { action: string; path?: string; homeMode?: number | null };
type SetupResult = { root: string; home: string; local: string; run: ReturnType<typeof spawnSync>; events: SetupEvent[] };

function nodeSetup(existing: boolean): SetupResult {
  const root = createRoot();
  const repo = join(root, "repo");
  const home = join(root, "hermes");
  const data = join(root, "data");
  const eventsPath = join(root, "events.json");
  const preload = join(root, "preload.cjs");
  const local = join(repo, ".env.local");
  try {
    fs.mkdirSync(repo);
    fs.mkdirSync(data);
    fs.mkdirSync(home);
    fs.writeFileSync(join(home, "config.yaml"), "model: fixture-only\n");
    fs.chmodSync(home, 0o777);
    if (POSIX) expect(mode(home)).toBe(0o777);
    if (existing) {
      fs.writeFileSync(join(home, ".env"), OLD);
    }
    for (const source of ["scripts/bootstrap/setup.mjs", "scripts/bootstrap/env-local.mjs", "scripts/tooling/_platform.mjs"]) {
      const target = join(repo, source);
      fs.mkdirSync(dirname(target), { recursive: true });
      fs.copyFileSync(join(REPO, source), target);
    }
    fs.writeFileSync(preload, NODE_PRELOAD);
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
    for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    Object.assign(env, {
      NODE_OPTIONS: "", HOME: root, APPDATA: root, LOCALAPPDATA: root,
      HERMES_HOME: home, PS_DATA_DIR: data, CH_DATA_DIR: data, CONTROL_HUB_DATA_DIR: data,
      PORT: "47328", ORACLE_REPO: repo, ORACLE_EVENTS: eventsPath,
    });
    const run = spawnSync(process.execPath, ["--require", preload, join(repo, "scripts", "bootstrap", "setup.mjs")], {
      cwd: repo, env, encoding: "utf8", timeout: 30_000, windowsHide: true,
    });
    if (run.error || run.signal || !fs.existsSync(eventsPath)) {
      throw new Error(`INFRASTRUCTURE: Node setup did not reach its disposable preload (${run.error?.message ?? run.signal ?? run.status})`);
    }
    const events = JSON.parse(fs.readFileSync(eventsPath, "utf8")) as SetupEvent[];
    if (!events.some((event) => event.action === "child")) {
      throw new Error("INFRASTRUCTURE: Node setup did not reach a stubbed external command");
    }
    return { root, home, local, run, events };
  } catch (error) {
    dispose(root);
    throw error;
  }
}

function bashExecutable(): string {
  const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
  return process.platform === "win32" && fs.existsSync(gitBash) ? gitBash : "bash";
}

function shellPath(path: string): string {
  if (process.platform !== "win32") return path;
  const run = spawnSync(bashExecutable(), ["-c", "cygpath -u \"$1\"", "oracle", path], { encoding: "utf8" });
  if (run.error || run.status !== 0 || !run.stdout.trim()) {
    throw new Error("INFRASTRUCTURE: Git Bash could not map a disposable fixture path");
  }
  return run.stdout.trim();
}

function shellSetup(existing: boolean): SetupResult {
  const root = createRoot();
  const repo = join(root, "repo");
  const home = join(root, "hermes");
  const data = join(root, "data");
  const bin = join(root, "bin");
  const eventsPath = join(root, "shell-events.txt");
  const local = join(repo, ".env.local");
  try {
    fs.mkdirSync(repo);
    fs.mkdirSync(data);
    fs.mkdirSync(bin);
    fs.mkdirSync(home);
    fs.writeFileSync(join(home, "config.yaml"), "model: fixture-only\n");
    fs.chmodSync(home, 0o777);
    if (POSIX) expect(mode(home)).toBe(0o777);
    if (existing) {
      fs.writeFileSync(join(home, ".env"), OLD);
    }
    for (const source of ["scripts/bootstrap/setup.sh", "scripts/lib/ps-env.sh", "scripts/lib/ps-dotenv-local.sh"]) {
      const target = join(repo, source);
      fs.mkdirSync(dirname(target), { recursive: true });
      fs.copyFileSync(join(REPO, source), target);
    }
    fs.appendFileSync(join(repo, "scripts", "lib", "ps-env.sh"), "\nps_noninteractive_install() { return 0; }\n");
    for (const [name, content] of [
      ["ps-port.sh", "ps_setup_port_and_dev_origins() { PS_SELECTED_PORT=47329; }\n"],
      ["ps-log.sh", "# disposable fixture\n"],
      ["ps-migrate.sh", "ps_migrate_run() { printf 'migration\\n' >> \"$ORACLE_EVENTS\"; }\n"],
    ]) fs.writeFileSync(join(repo, "scripts", "lib", name), content);
    for (const [name, content] of [
      ["node", "#!/usr/bin/env bash\nif [ \"$1\" = -v ]; then echo v20.0.0; elif [ \"$1\" = -e ]; then echo fixture-only-key; fi\n"],
      ["npm", "#!/usr/bin/env bash\nprintf 'npm\\n' >> \"$ORACLE_EVENTS\"\nexit 0\n"],
      ["npx", "#!/usr/bin/env bash\nprintf 'npx\\n' >> \"$ORACLE_EVENTS\"\nexit 0\n"],
    ]) {
      const target = join(bin, name);
      fs.writeFileSync(target, content);
      fs.chmodSync(target, 0o755);
    }
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
    for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    env.PATH = `${shellPath(bin)}${process.platform === "win32" ? ";" : ":"}${env.PATH ?? ""}`;
    env.HOME = shellPath(root);
    env.HERMES_HOME = shellPath(home);
    env.PS_DATA_DIR = shellPath(data);
    env.CH_DATA_DIR = env.PS_DATA_DIR;
    env.CONTROL_HUB_DATA_DIR = env.PS_DATA_DIR;
    env.APPDATA = env.HOME;
    env.LOCALAPPDATA = env.HOME;
    env.ORACLE_EVENTS = shellPath(eventsPath);
    env.PS_INSTALL_NONINTERACTIVE = "1";
    env.PS_SETUP_RUN_TESTS = "0";
    env.CI = "false";
    const run = spawnSync(bashExecutable(), ["-c", "umask 000; bash \"$1\"", "oracle", shellPath(join(repo, "scripts", "bootstrap", "setup.sh"))], {
      cwd: repo, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000, windowsHide: true,
    });
    if (run.error || run.signal || !fs.existsSync(eventsPath)) {
      throw new Error(`INFRASTRUCTURE: shell setup did not reach stubbed commands (${run.error?.message ?? run.signal ?? run.status})`);
    }
    return { root, home, local, run, events: [{ action: "child" }] };
  } catch (error) {
    dispose(root);
    throw error;
  }
}

describe("T-0163 review: setup secures the Hermes directory", () => {
  it.each([false, true])("Node setup secures Hermes home with existing .env=%s before credential I/O", (existing) => {
    const fixture = nodeSetup(existing);
    try {
      expect(fixture.run.status).toBe(0);
      expect(fs.existsSync(join(fixture.home, ".env"))).toBe(true);
      expect(fs.existsSync(fixture.local)).toBe(true);
      if (POSIX) {
        expect(mode(fixture.home)).toBe(0o700);
        const credentialIo = fixture.events.filter((event) => event.path === join(fixture.home, ".env"));
        expect(credentialIo.length).toBeGreaterThan(0);
        expect(credentialIo.map((event) => event.homeMode)).toEqual(credentialIo.map(() => 0o700));
      }
    } finally {
      dispose(fixture.root);
    }
  });

  it.each([false, true])("POSIX/Git Bash setup secures Hermes home with existing .env=%s", (existing) => {
    const fixture = shellSetup(existing);
    try {
      expect(fixture.run.status).toBe(0);
      expect(fs.existsSync(join(fixture.home, ".env"))).toBe(true);
      expect(fs.existsSync(fixture.local)).toBe(true);
      if (POSIX) expect(mode(fixture.home)).toBe(0o700);
    } finally {
      dispose(fixture.root);
    }
  });
});

let runtimeRoot: string;
let previousUmask: number;

beforeEach(() => {
  runtimeRoot = createRoot();
  (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__ = runtimeRoot;
  previousUmask = process.umask(0);
});

afterEach(() => {
  jest.restoreAllMocks();
  syncBuiltinESMExports();
  jest.useRealTimers();
  process.umask(previousUmask);
  dispose(runtimeRoot);
  delete (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__;
});

function runtimeEnv(): string {
  return join(runtimeRoot, ".env");
}

type DirectoryEvent = { path: string; homeMode: number; backupsMode: number | null };

function observeDirectoryIo(): DirectoryEvent[] {
  const events: DirectoryEvent[] = [];
  const read = fs.readFileSync;
  const write = fs.writeFileSync;
  const open = fs.openSync;
  const copy = fs.copyFileSync;
  const capture = (path: unknown) => {
    if (typeof path !== "string" ||
      (path !== runtimeEnv() && !path.startsWith(`${join(runtimeRoot, "backups")}${fsSep()}`))) return;
    const backups = join(runtimeRoot, "backups");
    events.push({ path, homeMode: mode(runtimeRoot), backupsMode: fs.existsSync(backups) ? mode(backups) : null });
  };
  jest.spyOn(fs, "readFileSync").mockImplementation(((...args: unknown[]) => {
    capture(args[0]);
    return Reflect.apply(read, fs, args);
  }) as typeof fs.readFileSync);
  jest.spyOn(fs, "writeFileSync").mockImplementation(((...args: unknown[]) => {
    capture(args[0]);
    return Reflect.apply(write, fs, args);
  }) as typeof fs.writeFileSync);
  jest.spyOn(fs, "openSync").mockImplementation(((...args: unknown[]) => {
    capture(args[0]);
    return Reflect.apply(open, fs, args);
  }) as typeof fs.openSync);
  jest.spyOn(fs, "copyFileSync").mockImplementation(((...args: unknown[]) => {
    capture(args[1]);
    return Reflect.apply(copy, fs, args);
  }) as typeof fs.copyFileSync);
  syncBuiltinESMExports();
  return events;
}

function fsSep(): string {
  return process.platform === "win32" ? "\\" : "/";
}

describe("T-0163 review: runtime directories", () => {
  it.each([false, true])("narrows Hermes home and %s-existing backups before replacement I/O", (existingBackups) => {
    fs.writeFileSync(runtimeEnv(), OLD);
    if (existingBackups) {
      fs.mkdirSync(join(runtimeRoot, "backups"));
      fs.chmodSync(join(runtimeRoot, "backups"), 0o777);
    }
    fs.chmodSync(runtimeRoot, 0o777);
    if (POSIX) {
      expect(mode(runtimeRoot)).toBe(0o777);
      if (existingBackups) expect(mode(join(runtimeRoot, "backups"))).toBe(0o777);
    }
    const events = observeDirectoryIo();
    const { syncCredentialToHermesEnv } = require("@/modules/hermes/lib/hermes-env-sync") as typeof import("@/modules/hermes/lib/hermes-env-sync");
    const result = syncCredentialToHermesEnv({ provider: "openrouter", apiKey: NEW_KEY });
    expect(fs.readFileSync(runtimeEnv(), "utf8")).toBe(OLD.replace("fixture-old", NEW_KEY));
    expect(result.backupPath).not.toBeNull();
    expect(fs.readFileSync(result.backupPath!, "utf8")).toBe(OLD);
    if (POSIX) {
      expect(mode(runtimeRoot)).toBe(0o700);
      expect(mode(join(runtimeRoot, "backups"))).toBe(0o700);
      const credentialEvents = events.filter((event) => event.path === runtimeEnv());
      const backupEvents = events.filter((event) => event.path.startsWith(`${join(runtimeRoot, "backups")}${fsSep()}`));
      expect(credentialEvents.length).toBeGreaterThan(0);
      expect(backupEvents.length).toBeGreaterThan(0);
      expect(credentialEvents.map((event) => event.homeMode)).toEqual(credentialEvents.map(() => 0o700));
      expect(backupEvents.map((event) => event.backupsMode)).toEqual(backupEvents.map(() => 0o700));
    }
  });
});

describe("T-0163 review: existing staging names", () => {
  it.each(["public file", "symlink"] as const)("never writes a key through a %s at the selected staging path", (kind) => {
    fs.writeFileSync(runtimeEnv(), OLD);
    if (!POSIX) {
      const { syncCredentialToHermesEnv } = require("@/modules/hermes/lib/hermes-env-sync") as typeof import("@/modules/hermes/lib/hermes-env-sync");
      syncCredentialToHermesEnv({ provider: "openrouter", apiKey: NEW_KEY });
      expect(fs.readFileSync(runtimeEnv(), "utf8")).toContain(NEW_KEY);
      return;
    }
    const publicTarget = join(runtimeRoot, "public-target.txt");
    const sentinel = "public sentinel\n";
    fs.writeFileSync(publicTarget, sentinel);
    fs.chmodSync(publicTarget, 0o666);
    const rawWrite = fs.writeFileSync;
    const rawOpen = fs.openSync;
    const rawWriteFd = fs.writeSync;
    let selected: string | null = null;
    let exposed = false;
    const inspect = () => {
      const target = kind === "symlink" ? publicTarget : selected;
      if (target && fs.existsSync(target) && fs.readFileSync(target, "utf8").includes(NEW_KEY)) exposed = true;
    };
    const plant = (path: unknown) => {
      if (selected || typeof path !== "string" || dirname(path) !== runtimeRoot ||
        !basename(path).startsWith(".env") || path === runtimeEnv()) return;
      selected = path;
      if (kind === "symlink") fs.symlinkSync(publicTarget, path);
      else {
        rawWrite(path, sentinel);
        fs.chmodSync(path, 0o666);
      }
    };
    jest.spyOn(fs, "writeFileSync").mockImplementation(((...args: unknown[]) => {
      plant(args[0]);
      try { return Reflect.apply(rawWrite, fs, args); }
      finally { inspect(); }
    }) as typeof fs.writeFileSync);
    jest.spyOn(fs, "openSync").mockImplementation(((...args: unknown[]) => {
      plant(args[0]);
      return Reflect.apply(rawOpen, fs, args);
    }) as typeof fs.openSync);
    jest.spyOn(fs, "writeSync").mockImplementation(((...args: unknown[]) => {
      try { return Reflect.apply(rawWriteFd, fs, args); }
      finally { inspect(); }
    }) as typeof fs.writeSync);
    syncBuiltinESMExports();
    const { syncCredentialToHermesEnv } = require("@/modules/hermes/lib/hermes-env-sync") as typeof import("@/modules/hermes/lib/hermes-env-sync");
    let failure: unknown;
    try {
      syncCredentialToHermesEnv({ provider: "openrouter", apiKey: NEW_KEY });
    } catch (error) {
      failure = error;
    }
    expect(selected).not.toBeNull();
    expect(exposed).toBe(false);
    expect(fs.readFileSync(publicTarget, "utf8")).toBe(sentinel);
    expect(fs.lstatSync(runtimeEnv()).isSymbolicLink()).toBe(false);
    if (failure) {
      expect(String(failure)).not.toContain(NEW_KEY);
      expect(fs.readFileSync(runtimeEnv(), "utf8")).toBe(OLD);
    } else {
      expect(fs.readFileSync(runtimeEnv(), "utf8")).toBe(OLD.replace("fixture-old", NEW_KEY));
    }
  });
});

describe("T-0163 review: backup name collisions", () => {
  it("keeps both private backups and their distinct contents within one millisecond", () => {
    fs.writeFileSync(runtimeEnv(), OLD);
    jest.useFakeTimers({ now: new Date("2026-09-27T08:00:00.123Z").getTime() });
    const { backupFile } = require("@/lib/fs/fs-helpers") as typeof import("@/lib/fs/fs-helpers");
    const backups = join(runtimeRoot, "backups");
    const first = backupFile(runtimeEnv(), backups);
    expect(first).not.toBeNull();
    fs.writeFileSync(runtimeEnv(), OLD.replace("fixture-old", "fixture-second"));
    const second = backupFile(runtimeEnv(), backups);
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(fs.readFileSync(first!, "utf8")).toBe(OLD);
    expect(fs.readFileSync(second!, "utf8")).toBe(OLD.replace("fixture-old", "fixture-second"));
    if (POSIX) {
      expect(mode(backups)).toBe(0o700);
      expect(mode(first!)).toBe(0o600);
      expect(mode(second!)).toBe(0o600);
    }
  });
});
