/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform, and the module the contract creates is loaded lazily so a missing file reds its own tests */

// ═══════════════════════════════════════════════════════════════
// B7 oracle, group provider-switch, the server half (T-0101, D64).
//
// Written before the product code moved. Contract section 1: there is ONE
// memory provider switch, the database holds it, and config.yaml is written to
// agree rather than consulted to disagree.
//
// THE DEFECT. `getMemoryProviderType()` hand-scans ~/.hermes/config.yaml for a
// `memory.provider:` line. Three callers read it: GET /api/memory, MemorySync
// and the subsystems panel. The Memory page writes the DATABASE. So switching
// the provider in the product changes what the Memory page talks to and
// nothing else, and a blank or malformed config.yaml reports "none" while
// Hindsight is live with thousands of facts. Two controls, two truths.
//
// THE CONTRACT. The database answers the question, and a PUT that makes a
// provider active writes `memory.provider` into config.yaml so the agent's own
// file says the same thing. A file that will not parse is reported, not
// overwritten, and never turns a successful database write into a 500.
//
// The DB fixture is memory-switch-is-honoured's: a real in-memory database with
// the baseline schema and migration 022. The Hermes home is a real temp
// directory, so the parse refusal is measured against bytes on disk.
// ═══════════════════════════════════════════════════════════════

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { execBaselineSchema } from "../helpers/baseline-db";
import { applyMemoryProvidersMigration } from "@/lib/db/apply-memory-providers-migration";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

const hermesHome = mkdtempSync(join(tmpdir(), "ps-b7-memory-"));

jest.mock("@/modules/hermes/lib/agent-runtime", () => {
  const { buildHermesPathBundle } = jest.requireActual(
    "@/modules/hermes/lib/paths",
  ) as typeof import("@/modules/hermes/lib/paths");
  return {
    getActiveHermesPaths: () => buildHermesPathBundle(hermesHome),
    getActiveHermesHome: () => hermesHome,
  };
});

// The default root is the same home, so the config writer's agent-root refresh
// (T-0100, D76) fires here too and needs a row to write.
jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  getHermesDefaultRoot: () => hermesHome,
}));

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

import { getMemoryProviderType } from "@/lib/memory/memory-providers";
import { updateMemoryProvider } from "@/lib/memory/memory-providers/repository";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");
const configPath = () => join(hermesHome, "config.yaml");
const MALFORMED = ["agent:", "  max_turns: 100", "  max_turns: 200", ""].join("\n");

/** The helper the contract adds, loaded lazily so a missing file reds one test. */
type WriteProviderResult = { written: boolean; error: string | null };
function writeMemoryProviderToHermesConfig(): (t: string) => WriteProviderResult {
  const mod = require("@/modules/hermes/lib/memory-provider-sync") as {
    writeMemoryProviderToHermesConfig?: (t: string) => WriteProviderResult;
  };
  if (typeof mod.writeMemoryProviderToHermesConfig !== "function") {
    throw new Error("memory-provider-sync exports no writeMemoryProviderToHermesConfig (contract 1)");
  }
  return mod.writeMemoryProviderToHermesConfig;
}

function diskDoc(): Record<string, Record<string, unknown>> {
  const yaml = require("js-yaml") as typeof import("js-yaml");
  return yaml.load(readFileSync(configPath(), "utf-8")) as Record<string, Record<string, unknown>>;
}

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyMemoryProvidersMigration(testDb, migrationsDir);
  rmSync(hermesHome, { recursive: true, force: true });
  require("fs").mkdirSync(hermesHome, { recursive: true });
  jest.clearAllMocks();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

afterAll(() => rmSync(hermesHome, { recursive: true, force: true }));

// ── FUSE ────────────────────────────────────────────────────────

describe("FUSE: this file writes only where it is allowed to", () => {
  it("resolves the Hermes home inside the OS temp directory", () => {
    expect(hermesHome.startsWith(tmpdir())).toBe(true);
    expect(configPath()).toContain("ps-b7-memory-");
  });
});

// ── the type comes from the database ────────────────────────────

describe("getMemoryProviderType answers from the database, not the file", () => {
  it("an active holographic row wins over a config.yaml that says hindsight", () => {
    writeFileSync(configPath(), "memory:\n  provider: hindsight\n", "utf-8");
    updateMemoryProvider("holographic", { enabled: true, makeActive: true });

    expect(getMemoryProviderType()).toBe("holographic");
  });

  it("an active row that is switched off reports none, whatever the file says", () => {
    writeFileSync(configPath(), "memory:\n  provider: hindsight\n", "utf-8");
    updateMemoryProvider("hindsight", { makeActive: true });
    updateMemoryProvider("hindsight", { enabled: false });

    expect(getMemoryProviderType()).toBe("none");
  });

  it("no config.yaml at all is not 'none': the seeded default still answers", () => {
    // The zero-config connect the operator ruled stays (T-0077). The old file
    // scan answered 'none' here, which is how a live Hindsight came to be
    // reported as no memory at all.
    if (existsSync(configPath())) rmSync(configPath());
    updateMemoryProvider("hindsight", { enabled: true, makeActive: true });

    expect(getMemoryProviderType()).toBe("hindsight");
  });

  it("the module no longer reads a file to answer it", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "lib", "memory", "memory-providers", "index.ts"),
      "utf-8",
    );

    // Booleans, so a miss names the line rather than printing the module.
    expect({
      readsAFile: /readFileSync|existsSync/.test(source),
      scansForProvider: /provider:/.test(source),
    }).toEqual({ readsAFile: false, scansForProvider: false });
  });
});

// ── the file is written to agree ────────────────────────────────

describe("writeMemoryProviderToHermesConfig", () => {
  it("sets memory.provider and leaves every other section alone", () => {
    writeFileSync(configPath(), "agent:\n  max_turns: 100\nmemory:\n  provider: hindsight\n", "utf-8");

    const result = writeMemoryProviderToHermesConfig()("holographic");

    expect(result).toEqual({ written: true, error: null });
    expect(diskDoc().memory.provider).toBe("holographic");
    expect(diskDoc().agent.max_turns).toBe(100);
  });

  it("creates the memory section when the file has none", () => {
    writeFileSync(configPath(), "agent:\n  max_turns: 100\n", "utf-8");

    expect(writeMemoryProviderToHermesConfig()("hindsight").written).toBe(true);
    expect(diskDoc().memory.provider).toBe("hindsight");
  });

  it("refuses an unparseable file, byte for byte, and says why", () => {
    writeFileSync(configPath(), MALFORMED, "utf-8");

    const result = writeMemoryProviderToHermesConfig()("holographic");

    expect(result.written).toBe(false);
    expect(String(result.error)).toMatch(/did not parse/);
    expect(readFileSync(configPath(), "utf-8")).toBe(MALFORMED);
  });

  it("a missing file is written, not refused: a fresh install has none", () => {
    if (existsSync(configPath())) rmSync(configPath());

    expect(writeMemoryProviderToHermesConfig()("hindsight")).toEqual({ written: true, error: null });
    expect(diskDoc().memory.provider).toBe("hindsight");
  });
});

// ── the route ───────────────────────────────────────────────────

describe("PUT /api/memory/config keeps the file in step", () => {
  async function put(body: unknown) {
    const { PUT } = await import("@/app/api/memory/config/route");
    const { NextRequest } = await import("next/server");
    const res = await PUT(
      new NextRequest("http://localhost/api/memory/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const json = (await res.json()) as {
      data?: { provider?: { type: string }; configYaml?: WriteProviderResult };
      error?: string;
    };
    return { status: res.status, json };
  }

  it("a PUT that activates a provider writes it into config.yaml", async () => {
    writeFileSync(configPath(), "memory:\n  provider: hindsight\n", "utf-8");

    const { status, json } = await put({ type: "holographic", makeActive: true });

    expect(status).toBe(200);
    expect(json.data?.provider?.type).toBe("holographic");
    expect(json.data?.configYaml).toEqual({ written: true, error: null });
    expect(diskDoc().memory.provider).toBe("holographic");
  });

  it("an unparseable file is reported in the answer, not raised as a 500", async () => {
    // The row moved. Saying so and naming the file that could not follow is
    // the honest report; a 500 would claim the save did not happen.
    writeFileSync(configPath(), MALFORMED, "utf-8");

    const { status, json } = await put({ type: "holographic", makeActive: true });

    expect(status).toBe(200);
    expect(json.data?.provider?.type).toBe("holographic");
    expect(json.data?.configYaml?.written).toBe(false);
    expect(String(json.data?.configYaml?.error)).toMatch(/did not parse/);
    expect(readFileSync(configPath(), "utf-8")).toBe(MALFORMED);
  });

  it("a PUT that only edits the endpoint touches no file", async () => {
    const before = "memory:\n  provider: hindsight\n";
    writeFileSync(configPath(), before, "utf-8");

    const { status, json } = await put({
      type: "hindsight",
      config: { host: "10.0.0.5", port: 9999, bank: "other" },
    });

    expect(status).toBe(200);
    expect(json.data?.configYaml).toBeNull();
    expect(readFileSync(configPath(), "utf-8")).toBe(before);
  });

  it("GREEN CONTROL: an unknown provider is still a 400", async () => {
    const { status } = await put({ type: "not-a-provider", makeActive: true });

    expect(status).toBe(400);
  });
});

// ── the settings field stops competing ──────────────────────────

describe("the Settings memory field is a pointer, not a second switch", () => {
  it("memory.provider declares who manages it", () => {
    const { CONFIG_SECTIONS } = require("@/lib/config-schema") as typeof import("@/lib/config-schema");
    const field = CONFIG_SECTIONS.memory.fields.find((f) => f.key === "provider");

    expect(field).toBeDefined();
    expect((field as { managedBy?: { label: string; href: string } }).managedBy).toEqual({
      label: "Memory",
      href: "/agent/memory",
    });
  });

  it("validateSectionValues refuses to set it, and names where it is set", () => {
    const { validateSectionValues } = require("@/lib/config-schema") as typeof import("@/lib/config-schema");

    expect(validateSectionValues("memory", { provider: "holographic" })).toEqual([
      { key: "provider", message: "Provider is set on the Memory page" },
    ]);
  });

  it("GREEN CONTROL: the section's other fields are still editable", () => {
    const { validateSectionValues } = require("@/lib/config-schema") as typeof import("@/lib/config-schema");

    expect(validateSectionValues("memory", { memory_enabled: true, nudge_interval: 5 })).toEqual([]);
  });
});
