/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- load the public runtime functions after the disposable root is set */

import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";

const fs = require("node:fs") as typeof import("node:fs");
const PREFIX = "t0163-hermes-permissions-";
const ORIGINAL = "# keep this comment\nOPENROUTER_API_KEY=fixture-old\nFOO=keep\n";
const NEW_KEY = "fixture-new-private-key";
const IS_LINUX = process.platform === "linux";

jest.mock("@/modules/hermes/lib/agent-runtime", () => require("../helpers/mocks").agentRuntimeFakeRootMock());

let root: string;
let previousUmask: number;

function envPath(): string {
  return join(root, ".env");
}

function mode(path: string): number {
  return fs.statSync(path).mode & 0o777;
}

function disposable(path: string): boolean {
  const inside = relative(root, path);
  return inside !== "" && inside !== ".." && !inside.startsWith(`..${sep}`) && !isAbsolute(inside);
}

function privateMode(path: string): void {
  if (IS_LINUX) expect(mode(path)).toBe(0o600);
  else expect(fs.existsSync(path)).toBe(true);
}

function originalWorldReadableEnv(): void {
  fs.writeFileSync(envPath(), ORIGINAL);
  if (IS_LINUX) {
    fs.chmodSync(envPath(), 0o666);
    expect(mode(envPath())).toBe(0o666);
  }
}

type Event = { path: string; mode: number };
function observeCredentialIo(): { creations: Event[]; reads: Event[]; restore: () => void } {
  const creations: Event[] = [];
  const reads: Event[] = [];
  const sensitive = (path: unknown): path is string =>
    typeof path === "string" && disposable(path) &&
    (basename(path).startsWith(".env") || path.startsWith(`${join(root, "backups")}${sep}`));
  const capture = (path: unknown, wasPresent: boolean) => {
    if (!wasPresent && sensitive(path) && fs.existsSync(path)) creations.push({ path, mode: mode(path) });
  };
  const write = fs.writeFileSync;
  const append = fs.appendFileSync;
  const copy = fs.copyFileSync;
  const open = fs.openSync;
  const read = fs.readFileSync;
  jest.spyOn(fs, "writeFileSync").mockImplementation(((...args: unknown[]) => {
    const existed = typeof args[0] === "string" && fs.existsSync(args[0]);
    const value = Reflect.apply(write, fs, args);
    capture(args[0], existed);
    return value;
  }) as typeof fs.writeFileSync);
  jest.spyOn(fs, "appendFileSync").mockImplementation(((...args: unknown[]) => {
    const existed = typeof args[0] === "string" && fs.existsSync(args[0]);
    const value = Reflect.apply(append, fs, args);
    capture(args[0], existed);
    return value;
  }) as typeof fs.appendFileSync);
  jest.spyOn(fs, "copyFileSync").mockImplementation(((...args: unknown[]) => {
    const existed = typeof args[1] === "string" && fs.existsSync(args[1]);
    const value = Reflect.apply(copy, fs, args);
    capture(args[1], existed);
    return value;
  }) as typeof fs.copyFileSync);
  jest.spyOn(fs, "openSync").mockImplementation(((...args: unknown[]) => {
    const existed = typeof args[0] === "string" && fs.existsSync(args[0]);
    const descriptor = Reflect.apply(open, fs, args) as number;
    if (!existed && sensitive(args[0])) creations.push({ path: args[0], mode: fs.fstatSync(descriptor).mode & 0o777 });
    return descriptor;
  }) as typeof fs.openSync);
  jest.spyOn(fs, "readFileSync").mockImplementation(((...args: unknown[]) => {
    if (sensitive(args[0]) && fs.existsSync(args[0])) reads.push({ path: args[0], mode: mode(args[0]) });
    return Reflect.apply(read, fs, args);
  }) as typeof fs.readFileSync);
  syncBuiltinESMExports();
  return { creations, reads, restore: () => { jest.restoreAllMocks(); syncBuiltinESMExports(); } };
}

beforeEach(() => {
  root = fs.mkdtempSync(join(tmpdir(), PREFIX));
  (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__ = root;
  previousUmask = process.umask(0);
});

afterEach(() => {
  jest.restoreAllMocks();
  syncBuiltinESMExports();
  process.umask(previousUmask);
  const actual = fs.realpathSync(root);
  if (dirname(actual) !== fs.realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
    throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
  }
  fs.rmSync(actual, { recursive: true, force: true });
  delete (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__;
});

describe("T-0163 Hermes credential dotenv permissions", () => {
  it("creates a fresh Hermes .env and its staging file owner-only from the first write", () => {
    const observed = observeCredentialIo();
    try {
      const { syncCredentialToHermesEnv } = require("@/modules/hermes/lib/hermes-env-sync") as typeof import("@/modules/hermes/lib/hermes-env-sync");
      syncCredentialToHermesEnv({ provider: "anthropic", apiKey: NEW_KEY });
    } finally {
      observed.restore();
    }
    expect(fs.readFileSync(envPath(), "utf8")).toContain(`ANTHROPIC_API_KEY=${NEW_KEY}`);
    privateMode(envPath());
    if (IS_LINUX) {
      expect(observed.creations.length).toBeGreaterThan(0);
      expect(observed.creations.map((event) => event.mode)).toEqual(observed.creations.map(() => 0o600));
    }
  });

  it("narrows an existing public .env before reading it and keeps every unrelated line", () => {
    originalWorldReadableEnv();
    const observed = observeCredentialIo();
    try {
      const { syncCredentialToHermesEnv } = require("@/modules/hermes/lib/hermes-env-sync") as typeof import("@/modules/hermes/lib/hermes-env-sync");
      syncCredentialToHermesEnv({ provider: "openrouter", apiKey: NEW_KEY });
    } finally {
      observed.restore();
    }
    expect(fs.readFileSync(envPath(), "utf8")).toBe(ORIGINAL.replace("fixture-old", NEW_KEY));
    privateMode(envPath());
    if (IS_LINUX) {
      expect(observed.reads.filter((event) => event.path === envPath()).length).toBeGreaterThan(0);
      expect(observed.reads.filter((event) => event.path === envPath()).map((event) => event.mode))
        .toEqual(observed.reads.filter((event) => event.path === envPath()).map(() => 0o600));
      expect(observed.creations.map((event) => event.mode)).toEqual(observed.creations.map(() => 0o600));
    }
  });

  it("makes the plaintext replacement backup private from creation", () => {
    originalWorldReadableEnv();
    const observed = observeCredentialIo();
    let backupPath: string | null = null;
    try {
      const { syncCredentialToHermesEnv } = require("@/modules/hermes/lib/hermes-env-sync") as typeof import("@/modules/hermes/lib/hermes-env-sync");
      backupPath = syncCredentialToHermesEnv({ provider: "openrouter", apiKey: NEW_KEY }).backupPath;
    } finally {
      observed.restore();
    }
    expect(backupPath).not.toBeNull();
    expect(fs.readFileSync(backupPath!, "utf8")).toBe(ORIGINAL);
    privateMode(backupPath!);
    if (IS_LINUX) {
      const backups = observed.creations.filter((event) => event.path === backupPath);
      expect(backups.length).toBeGreaterThan(0);
      expect(backups.map((event) => event.mode)).toEqual(backups.map(() => 0o600));
    }
  });

  it("removes a credential only after narrowing the existing .env, preserving other keys", () => {
    originalWorldReadableEnv();
    const observed = observeCredentialIo();
    let backupPath: string | null = null;
    try {
      const { removeCredentialFromHermesEnv } = require("@/modules/hermes/lib/hermes-env-sync") as typeof import("@/modules/hermes/lib/hermes-env-sync");
      backupPath = removeCredentialFromHermesEnv("openrouter").backupPath;
    } finally {
      observed.restore();
    }
    expect(fs.readFileSync(envPath(), "utf8")).toBe("# keep this comment\nFOO=keep\n");
    expect(backupPath).not.toBeNull();
    expect(fs.readFileSync(backupPath!, "utf8")).toBe(ORIGINAL);
    privateMode(envPath());
    privateMode(backupPath!);
    if (IS_LINUX) {
      expect(observed.reads.filter((event) => event.path === envPath()).map((event) => event.mode))
        .toEqual(observed.reads.filter((event) => event.path === envPath()).map(() => 0o600));
      expect(observed.creations.map((event) => event.mode)).toEqual(observed.creations.map(() => 0o600));
    }
  });

  it.each(["replace", "remove"] as const)("fails closed when a public .env cannot be secured before %s", (action) => {
    originalWorldReadableEnv();
    if (!IS_LINUX) {
      const runtime = require("@/modules/hermes/lib/hermes-env-sync") as typeof import("@/modules/hermes/lib/hermes-env-sync");
      if (action === "replace") runtime.syncCredentialToHermesEnv({ provider: "openrouter", apiKey: NEW_KEY });
      else runtime.removeCredentialFromHermesEnv("openrouter");
      expect(fs.existsSync(envPath())).toBe(true);
      return;
    }
    const chmod = fs.chmodSync;
    jest.spyOn(fs, "chmodSync").mockImplementation(((...args: unknown[]) => {
      if (args[0] === envPath()) throw Object.assign(new Error("permission denied"), { code: "EACCES" });
      return Reflect.apply(chmod, fs, args);
    }) as typeof fs.chmodSync);
    syncBuiltinESMExports();
    const runtime = require("@/modules/hermes/lib/hermes-env-sync") as typeof import("@/modules/hermes/lib/hermes-env-sync");
    let failure: unknown;
    try {
      if (action === "replace") runtime.syncCredentialToHermesEnv({ provider: "openrouter", apiKey: NEW_KEY });
      else runtime.removeCredentialFromHermesEnv("openrouter");
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeDefined();
    expect(String(failure)).not.toContain("fixture-old");
    expect(String(failure)).not.toContain(NEW_KEY);
    expect(fs.readFileSync(envPath(), "utf8")).toBe(ORIGINAL);
    expect(mode(envPath())).toBe(0o666);
  });

  it("the shared backup operation writes a credential .env backup owner-only", () => {
    originalWorldReadableEnv();
    const { backupFile } = require("@/lib/fs/fs-helpers") as typeof import("@/lib/fs/fs-helpers");
    const observed = observeCredentialIo();
    let backupPath: string | null = null;
    try {
      backupPath = backupFile(envPath(), join(root, "backups"));
    } finally {
      observed.restore();
    }
    expect(backupPath).not.toBeNull();
    expect(fs.readFileSync(backupPath!, "utf8")).toBe(ORIGINAL);
    privateMode(backupPath!);
    if (IS_LINUX) {
      expect(observed.creations.filter((event) => event.path === backupPath).map((event) => event.mode))
        .toEqual([0o600]);
    }
  });
});
