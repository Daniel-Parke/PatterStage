/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

// T-0077 acceptance oracle — the memory provider the database says is active is
// the one the product talks to, and the one it names.
//
// THE REPORTED SYMPTOM. Switch the provider to holographic via
// PUT /api/memory/config, reload, and the page still reports hindsight with the
// same facts. The QA pass diagnosed it as GET /api/memory re-parsing the agent's
// config.yaml. That is not it — and the distinction matters, because the
// config.yaml read is DELIBERATE and documented: docs/MEMORY.md says the file is
// consulted for exactly one thing, recognising a holographic install, and
// "does not decide where Hindsight is reached". Migration 022's own header says
// PatterStage is "the source of truth for WHICH memory provider is active and
// HOW to reach it".
//
// THERE ARE THREE REAL DEFECTS, and any one of them reproduces the report.
//
//   RC-1  registry.ts switches on the type and its `default:` builds a
//         HindsightMemoryProvider. Every type is Hindsight, so flipping the DB
//         row is structurally unobservable.
//   RC-2  GET /api/memory hardcodes `provider: "hindsight"` in the success body
//         regardless of what was resolved.
//   RC-3  the sharpest. getActiveMemoryConfig ignores an active-but-DISABLED
//         row and substitutes a hardcoded hindsight@127.0.0.1:9177 — and
//         updateMemoryProvider's insert path writes `enabled = patch.enabled ? 1
//         : 0`, so a PUT that sets makeActive and omits enabled CREATES exactly
//         that row, returns 200, and every reader silently talks to 9177.
//
// THAT IS ALSO HOW A QA INSTANCE READ THE OPERATOR'S REAL MEMORY. A throwaway
// install seeds hindsight@127.0.0.1:9177 active, and 9177 is where a real
// Hindsight listens. The operator ruled: keep the zero-config connect, but say
// out loud that it is the built-in default until they have confirmed it. That
// needs no migration — `updated_at !== created_at` already records whether a
// human has ever saved the row.
//
// WHY IT SURVIVED. GET /api/memory has no in-app consumer at all (the page
// reads /api/memory/config and /api/memory/hindsight), and no test asserts that
// makeActive changes what getActiveMemoryProvider returns. That assertion is the
// first one below.

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

import {
  getActiveMemoryConfig,
  listMemoryProviders,
  updateMemoryProvider,
} from "@/lib/memory/memory-providers/repository";
import { getActiveMemoryProvider } from "@/lib/memory/memory-providers/registry";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyMemoryProvidersMigration(testDb, migrationsDir);
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("switching the provider changes what the product talks to", () => {
  it("makeActive changes what getActiveMemoryProvider returns", () => {
    // The missing control. Any one of the three root causes breaks it, which is
    // why nothing else in the suite ever went red while all three were live.
    updateMemoryProvider("holographic", { enabled: true, makeActive: true });

    expect(getActiveMemoryProvider().type).toBe("holographic");
  });

  it("an unknown provider type is not silently served by the Hindsight client", () => {
    // `default:` as a hindsight alias means a future backend added to the union
    // and forgotten here talks to Hindsight's endpoint while claiming to be
    // itself. Failing honestly is the only safe default.
    updateMemoryProvider("holographic", { enabled: true, makeActive: true });

    const provider = getActiveMemoryProvider();
    expect(provider.type).not.toBe("hindsight");
  });

  it("the resolved config keeps the host and port that were saved", () => {
    updateMemoryProvider("hindsight", {
      enabled: true,
      makeActive: true,
      config: { host: "10.0.0.5", port: 9999, bank: "other" },
    });

    const { config } = getActiveMemoryConfig();
    expect(config.host).toBe("10.0.0.5");
    expect(config.port).toBe(9999);
  });
});

describe("an active row that is switched off is not quietly replaced", () => {
  it("reports none rather than substituting the built-in Hindsight endpoint", () => {
    // RC-3. The row says "active but disabled". Answering with a DIFFERENT
    // provider's hardcoded default endpoint is the single most misleading thing
    // this module can do — it is what pointed a throwaway QA install at a real
    // Hindsight on 9177.
    updateMemoryProvider("hindsight", { enabled: false, makeActive: true });

    const { type } = getActiveMemoryConfig();
    expect(type).toBe("none");
  });

  it("makeActive implies enabled, so a PUT cannot create that row by omission", () => {
    // The insert path wrote `enabled = patch.enabled ? 1 : 0`, so a PUT that
    // asked to activate a provider and said nothing about `enabled` produced
    // is_active=1, enabled=0 — active and ignored — and answered 200.
    const row = updateMemoryProvider("holographic", { makeActive: true });

    expect(row?.isActive).toBe(true);
    expect(row?.enabled).toBe(true);
    expect(getActiveMemoryConfig().type).toBe("holographic");
  });

  it("GREEN CONTROL: explicitly disabling without activating still disables", () => {
    // The narrowing must not become "enabled is always true". An operator
    // turning a provider off, without making it active, is a real intent.
    updateMemoryProvider("holographic", { enabled: false });

    const holo = listMemoryProviders().find((p) => p.type === "holographic");
    expect(holo?.enabled).toBe(false);
  });

  it("with NO row at all, still auto-connects to the built-in default", () => {
    // Found by mutation. The control below uses the SEEDED row, so the
    // no-row-at-all fallback -- a database predating migration 022, or one
    // whose rows were deleted -- was never exercised. That path is what makes a
    // fresh install work with no setup, and the operator ruled it stays.
    testDb!.prepare("DELETE FROM memory_providers").run();

    const { type, config } = getActiveMemoryConfig();
    expect(type).toBe("hindsight");
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(9177);
  });

  it("GREEN CONTROL: a fresh install still auto-connects, per the operator's ruling", () => {
    // Zero-config connect is deliberate and stays. The seeded row is active AND
    // enabled, so this must resolve to hindsight on the built-in endpoint — the
    // fix is to LABEL it, not to remove it.
    const { type, config } = getActiveMemoryConfig();
    expect(type).toBe("hindsight");
    expect(config.port).toBe(9177);
  });
});

describe("the built-in default says it is the built-in default", () => {
  it("a seeded row that nobody has saved reports itself unconfirmed", () => {
    // No migration needed: the table already carries created_at and updated_at,
    // and the seed sets both to the same instant. A save moves updated_at.
    const seeded = listMemoryProviders().find((p) => p.type === "hindsight");
    expect(seeded?.confirmed).toBe(false);
  });

  it("saving the config confirms it, even if nothing changed", () => {
    // Confirmation is the operator having looked at it and pressed Save. That
    // is exactly what turns "we guessed 9177" into "you told us 9177".
    updateMemoryProvider("hindsight", {
      enabled: true,
      makeActive: true,
      config: { host: "127.0.0.1", port: 9177, bank: "hermes" },
    });

    const row = listMemoryProviders().find((p) => p.type === "hindsight");
    expect(row?.confirmed).toBe(true);
  });

  // The card's banner is asserted by RENDERING it, in
  // memory-default-says-it-guessed.test.tsx. A source grep lived here first and
  // mutation killed it: replacing the JSX condition with `{false && (` left the
  // phrase in the file -- in the comment explaining the banner -- so the check
  // passed while the banner was unreachable.
});

describe("the API names the provider it actually resolved", () => {
  it("neither the success body nor the fallback hardcodes a provider name", () => {
    // RC-2, and its twin found while proving this batch end to end: the success
    // path said "hindsight" whatever was active, and the NOT-REACHABLE path said
    // a flat "none" -- collapsing "nothing is configured" and "holographic is
    // configured and we have no client for it" into one unhelpful word. The
    // operator cannot act on either without knowing WHICH backend is meant.
    const route = require("fs").readFileSync(
      join(process.cwd(), "src", "app", "api", "memory", "route.ts"),
      "utf-8",
    ) as string;
    expect(route).not.toMatch(/provider:\s*"hindsight"/);
    expect(route).not.toMatch(/provider:\s*"none"/);
  });
});
