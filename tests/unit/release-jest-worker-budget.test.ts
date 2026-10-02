/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { stripVTControlCharacters } from "node:util";

type Observation = { maxWorkers: number; coverage: boolean; inventory: number; configHash: string };
const repository = process.cwd();
const requireInstalled = createRequire(join(repository, "package.json"));
const jestCli = requireInstalled.resolve("jest/bin/jest");
const supportFiles = [
  "jest.config.js", "package.json", "next.config.ts", "tsconfig.json",
  "scripts/tooling/coverage-floors.cjs", "src/lib/config/config-sections.ts",
  "tests/jest.setup.ts", "tests/__mocks__/better-sqlite3.cjs",
];
const observations = new Map<string, Observation>();
let control: Observation;
let invalidValidationCompleted = false;

function infrastructure(reason: string): never {
  throw new Error(`T-0205 worker-budget infrastructure: ${reason}`);
}

function probe(inventory: number, coverage: boolean, mode: "canonical" | "absent" | "invalid" = "canonical", flags: string[] = []): Observation {
  if (mode === "invalid") invalidValidationCompleted = false;
  // Preserve every uniquely owned probe, including refused launches, for diagnosis.
  const owned = mkdtempSync(join(tmpdir(), "t0205-worker-budget-"));
  const project = join(owned, "project");
  for (const file of supportFiles) {
    mkdirSync(dirname(join(project, file)), { recursive: true });
    copyFileSync(join(repository, file), join(project, file));
  }
  mkdirSync(join(project, "src/app"), { recursive: true });
  symlinkSync(join(repository, "node_modules"), join(project, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  for (const name of ["home", "data", "temp", "cache"]) mkdirSync(join(owned, name));
  const canonical = join(project, "jest.config.js");
  const configHash = createHash("sha256").update(readFileSync(canonical)).digest("hex");
  let config = canonical;
  if (mode !== "canonical") {
    config = join(project, "control.config.cjs");
    writeFileSync(config, mode === "invalid" ? "module.exports = { maxWorkers: { invalid: true } };\n" :
      "module.exports = async () => { const value = require('./jest.config.js'); const config = typeof value === 'function' ? await value() : await value; delete config.maxWorkers; return config; };\n");
  }
  const preload = join(owned, "inventory.cjs");
  const inventoryReceipt = join(owned, "inventory.json");
  writeFileSync(preload, `
const os = require('node:os');
const fs = require('node:fs');
const size = ${inventory};
let cpuCalls = 0, parallelCalls = 0;
os.cpus = () => { cpuCalls++; return Array.from({ length: size }, () => ({ model: 'owned inventory', speed: 1, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } })); };
os.availableParallelism = () => { parallelCalls++; return size; };
require('node:module').syncBuiltinESMExports();
const observed = { cpus: os.cpus().length, parallelism: os.availableParallelism(), pid: process.pid };
cpuCalls = 0; parallelCalls = 0;
process.on('exit', () => fs.writeFileSync(${JSON.stringify(inventoryReceipt)}, JSON.stringify({ ...observed, cpuCalls, parallelCalls })));
`);
  const environment: Record<string, string | undefined> = {};
  for (const name of ["PATH", "Path", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC"]) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  Object.assign(environment, {
    NODE_ENV: "test", HOME: join(owned, "home"), USERPROFILE: join(owned, "home"),
    APPDATA: join(owned, "home"), LOCALAPPDATA: join(owned, "home"), XDG_CACHE_HOME: join(owned, "cache"),
    TEMP: join(owned, "temp"), TMP: join(owned, "temp"), TMPDIR: join(owned, "temp"),
    PS_DATA_DIR: join(owned, "data"), CH_DATA_DIR: join(owned, "data"), HERMES_HOME: join(owned, "home"),
    NEXT_TELEMETRY_DISABLED: "1", CI: "1",
  });
  const args = ["--require", preload, jestCli, "--config", config, "--showConfig", "--no-cache", ...flags];
  if (coverage) args.push("--coverage");
  const result = spawnSync(process.execPath, args, {
    cwd: project, encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024,
    env: environment as NodeJS.ProcessEnv,
  });
  const launchError = result.error as NodeJS.ErrnoException | undefined;
  writeFileSync(join(owned, "stdout.json"), result.stdout || "");
  writeFileSync(join(owned, "stderr.txt"), result.stderr || "");
  writeFileSync(join(owned, "receipt.json"), JSON.stringify({ inventory, coverage, mode, flags, configHash,
    status: result.status, signal: result.signal, error: launchError?.code ?? null }, null, 2));
  if (mode === "invalid" && !result.error && !result.signal && result.status === 1 && result.stdout.trim() === "" &&
      stripVTControlCharacters(result.stderr).replace(/\r\n/g, "\n").trim() ===
      "Validation Error:\n\nmaxWorkers has to be of type string or number\n\nmaxWorkers=50% or\nmaxWorkers=3") {
    try {
      const controlled = JSON.parse(readFileSync(inventoryReceipt, "utf8")) as { cpus: number; parallelism: number };
      invalidValidationCompleted = controlled.cpus === inventory && controlled.parallelism === inventory;
    } catch {
      infrastructure(`invalid configuration inventory receipt missing; receipt ${owned}`);
    }
  }
  if (result.error || result.signal || result.status !== 0) infrastructure(`configuration probe refused (status ${result.status}, signal ${result.signal}, error ${launchError?.code ?? "none"}); receipt ${owned}`);
  let resolvedConfig: { globalConfig: { maxWorkers: number; collectCoverage: boolean }; configs: { rootDir: string }[] };
  let controlled: { cpus: number; parallelism: number; cpuCalls: number; parallelCalls: number };
  try {
    resolvedConfig = JSON.parse(result.stdout);
    controlled = JSON.parse(readFileSync(inventoryReceipt, "utf8"));
  } catch {
    infrastructure(`configuration or inventory JSON missing; receipt ${owned}`);
  }
  if (!resolvedConfig.globalConfig || !Number.isInteger(resolvedConfig.globalConfig.maxWorkers) ||
      resolvedConfig.globalConfig.collectCoverage !== coverage || resolvedConfig.configs?.length !== 1 ||
      resolve(resolvedConfig.configs[0].rootDir) !== project || controlled.cpus !== inventory || controlled.parallelism !== inventory) {
    infrastructure(`unqualified resolved configuration or CPU inventory; receipt ${owned}`);
  }
  if (mode === "absent" && controlled.cpuCalls + controlled.parallelCalls === 0) infrastructure(`Jest did not consume the controlled inventory; receipt ${owned}`);
  return { maxWorkers: resolvedConfig.globalConfig.maxWorkers, coverage, inventory, configHash };
}

beforeAll(() => {
  for (const inventory of [1, 2, 64]) {
    for (const coverage of [false, true]) observations.set(`${inventory}:${coverage}`, probe(inventory, coverage));
  }
  control = probe(64, false, "absent");
}, 150_000);

describe("T-0205 independent canonical Jest worker budget oracle", () => {
  it.each([
    ["W01 ordinary single CPU", 1, false], ["W02 coverage single CPU", 1, true],
    ["W03 ordinary two CPUs", 2, false], ["W04 coverage two CPUs", 2, true],
    ["W05 ordinary large inventory", 64, false], ["W06 coverage large inventory", 64, true],
  ] as const)("%s resolves a positive worker cap no larger than two", (_name, inventory, coverage) => {
    const result = observations.get(`${inventory}:${coverage}`)!;
    expect(result.maxWorkers).toBeGreaterThan(0);
    expect(result.maxWorkers).toBeLessThanOrEqual(2);
    if (inventory === 64) expect(result.maxWorkers).toBe(2);
  });

  it("W07 removed budget exposes an unbounded large-host default through real Jest CLI", () => {
    expect(control.maxWorkers).toBeGreaterThan(2);
    expect(new Set([...observations.values()].map((result) => result.configHash))).toEqual(new Set([control.configHash]));
  });

  it("W08 explicit CLI worker override remains available", () => {
    expect(probe(64, false, "canonical", ["--maxWorkers=5"]).maxWorkers).toBe(5);
    expect(probe(64, true, "canonical", ["--maxWorkers=5"]).maxWorkers).toBe(5);
  }, 45_000);

  it("W09 invalid configuration is infrastructure refusal rather than a budget assertion", () => {
    try {
      expect(() => probe(64, false, "invalid")).toThrow("T-0205 worker-budget infrastructure: configuration probe refused");
    } finally {
      if (!invalidValidationCompleted) infrastructure("invalid maxWorkers control did not complete the expected Jest validation rejection");
    }
  }, 25_000);
});
