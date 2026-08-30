/**
 * @jest-environment node
 *
 * Unit test for the config-cache module extracted from
 * `src/app/api/config/route.ts` (List 4 refactor, session 187).
 *
 * The pre-refactor route had `readCachedConfig` + `invalidateConfigCache`
 * inline, with the 2 cache key strings repeated 4× across the read +
 * write + invalidate blocks. The refactor moved the logic into
 * `src/lib/config-cache.ts` with a single `CACHE_KEY_JSON` /
 * `CACHE_KEY_AT` const pair.
 *
 * This test pins the post-extraction shape so a future
 * "inline the cache back into the route" PR can't regress:
 *   - Cache hit returns the stored JSON
 *   - Cache miss falls through to filesystem
 *   - Stale cache (TTL expired) is bypassed
 *   - `invalidateConfigCache()` removes both keys
 *   - Cache write populates both keys in a transaction
 *   - Missing file returns `{}` and skips cache write
 *   - YAML parse error returns `{}` on the READ path and does not crash. A GET
 *     contract ONLY: a read-modify-write must parse explicitly and refuse. See
 *     tests/unit/config-put-refuses-unparseable-yaml.test.ts (T-0060).
 */

import { readCachedConfig, invalidateConfigCache } from "@/lib/config-cache";

const metaStore: Map<string, string> = new Map();
let prepareCallCount = 0;
let transactionCallCount = 0;
let allReturn: Array<{ key: string; value: string }> = [];

jest.mock("@/lib/db", () => ({
  getDb: () => ({
    prepare: (sql: string) => {
      prepareCallCount++;
      return {
        run: (...args: unknown[]) => {
          if (sql.startsWith("INSERT OR REPLACE INTO meta")) {
            const [key, value] = args as [string, string];
            metaStore.set(key, value);
          } else if (sql.startsWith("DELETE FROM meta")) {
            for (const arg of args) {
              if (typeof arg === "string") metaStore.delete(arg);
            }
          }
          return {};
        },
        all: () => allReturn,
        get: () => undefined,
      };
    },
    transaction: (fn: () => unknown) => {
      transactionCallCount++;
      return fn;
    },
  }),
  inTransaction: (fn: () => unknown) => fn,
  uuid: () => "uuid",
  now: () => "2026-06-12T00:00:00.000Z",
}));

// Mock hermes-agent-runtime so the cache's filesystem branch reads
// from a temp file we control.
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const tempDir = mkdtempSync(join(tmpdir(), "config-cache-test-"));
const fakeConfigPath = join(tempDir, "config.yaml");

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => ({
    config: fakeConfigPath,
    backups: join(tempDir, "backups"),
    soul: "/dev/null",
    agents: "/dev/null",
    userMemory: "/dev/null",
    agentMemory: "/dev/null",
    hermes: "/dev/null",
    env: "/dev/null",
    auth: "/dev/null",
  }),
}));

beforeEach(() => {
  metaStore.clear();
  prepareCallCount = 0;
  transactionCallCount = 0;
  allReturn = [];
  // Clean up the fake config file before each test
  if (existsSync(fakeConfigPath)) {
    rmSync(fakeConfigPath);
  }
});

afterAll(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
});

describe("config-cache — List 4 extraction (session 187)", () => {
  test("returns the cached JSON object on a cache hit (no filesystem read)", () => {
    // Pre-populate the cache with a known shape
    const cached = { model: { default: "gpt-4o" }, agent: { max_turns: 50 } };
    metaStore.set("config.cached_json", JSON.stringify(cached));
    metaStore.set("config.cached_at", new Date().toISOString());
    allReturn = [
      { key: "config.cached_json", value: metaStore.get("config.cached_json")! },
      { key: "config.cached_at", value: metaStore.get("config.cached_at")! },
    ];

    const result = readCachedConfig();
    expect(result).toEqual(cached);

    // No filesystem write should have happened (cache is fresh, so
    // the helper returned the cached shape without re-populating).
    // A re-populate only happens on the cache-miss branch.
    expect(prepareCallCount).toBe(1); // one SELECT .all() call
  });

  test("falls through to the filesystem on a cache miss and re-populates the cache", () => {
    // Cache is empty
    allReturn = [];
    // Filesystem has a config
    writeFileSync(fakeConfigPath, "model:\n  default: claude-sonnet-4\n");

    const result = readCachedConfig();
    expect(result).toEqual({ model: { default: "claude-sonnet-4" } });

    // The helper should have re-populated the cache with both keys
    expect(metaStore.get("config.cached_json")).toBe(
      JSON.stringify({ model: { default: "claude-sonnet-4" } }),
    );
    expect(metaStore.get("config.cached_at")).toBeDefined();

    // Both keys were written in a single transaction
    expect(transactionCallCount).toBe(1);
  });

  test("falls through to the filesystem when the cache is stale (TTL expired)", () => {
    // Cache is 30 seconds old — TTL is 15 seconds, so the cache is stale
    const staleDate = new Date(Date.now() - 30_000).toISOString();
    metaStore.set("config.cached_json", JSON.stringify({ from: "stale" }));
    metaStore.set("config.cached_at", staleDate);
    allReturn = [
      { key: "config.cached_json", value: metaStore.get("config.cached_json")! },
      { key: "config.cached_at", value: metaStore.get("config.cached_at")! },
    ];
    // Filesystem has a different config
    writeFileSync(fakeConfigPath, "from: filesystem\n");

    const result = readCachedConfig();
    expect(result).toEqual({ from: "filesystem" });
  });

  test("invalidateConfigCache() removes both keys", () => {
    metaStore.set("config.cached_json", "{}");
    metaStore.set("config.cached_at", new Date().toISOString());

    invalidateConfigCache();

    expect(metaStore.has("config.cached_json")).toBe(false);
    expect(metaStore.has("config.cached_at")).toBe(false);
  });

  test("returns {} when the filesystem has no config file and does not populate the cache", () => {
    // Cache empty, no filesystem file
    allReturn = [];
    // fakeConfigPath does not exist (cleaned in beforeEach)

    const result = readCachedConfig();
    expect(result).toEqual({});

    // The early-return path does NOT populate the cache — only the
    // successful yaml.parse branch does. A future "populate cache
    // on missing-file" PR would change this invariant; this test
    // pins the original behaviour.
    expect(metaStore.has("config.cached_json")).toBe(false);
  });

  test("returns {} on a YAML parse error: a READ-path degrade, never the basis for a write", () => {
    // The assertion is right and the SCOPE was not. GET /api/config must keep
    // rendering when config.yaml is broken, or the operator is blanked out of
    // the very screens that would tell them it is broken. What it must never be
    // taken for is a general contract: a read-modify-write that consumes this {}
    // writes it back over the file. That is exactly what PUT /api/config did
    // until T-0060, destroying the config and answering 200. The enforcing test
    // is tests/unit/config-put-refuses-unparseable-yaml.test.ts.
    allReturn = [];
    writeFileSync(fakeConfigPath, "model: { broken: [unclosed\n");

    const result = readCachedConfig();
    expect(result).toEqual({});

    // The failed parse is NOT cached. Pinning this stops a future "cache the {}
    // so we stop re-reading a broken file" optimisation from making the degrade
    // sticky for a TTL and pushing it into callers that never asked for it.
    expect(metaStore.has("config.cached_json")).toBe(false);
  });

  test("falls through to the filesystem when the SELECT throws (db unavailable)", () => {
    // Verify the catch path in readConfigCache() — if the prepared
    // statement's .all() throws (e.g. db file locked, meta table
    // missing on a fresh DB), the helper must return null so the
    // outer readCachedConfig falls through to the filesystem read.
    // We re-import the module inside isolateModules with a
    // throwing prepare to exercise the throw path end-to-end.
    jest.isolateModules(() => {
      jest.doMock("@/lib/db", () => ({
        getDb: () => ({
          prepare: () => ({
            run: () => ({}),
            all: () => {
              throw new Error("DB unavailable");
            },
            get: () => undefined,
          }),
          transaction: (fn: () => unknown) => fn,
        }),
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const isolated = require("@/lib/config-cache");
      writeFileSync(fakeConfigPath, "from: disk-after-throw\n");
      const result = isolated.readCachedConfig();
      expect(result).toEqual({ from: "disk-after-throw" });
    });
  });

  test("byte-equivalent: the cache hit returns the same shape as the filesystem branch on a fresh cache", () => {
    // First call: cache empty, filesystem has config → cache miss
    allReturn = [];
    writeFileSync(fakeConfigPath, "model: { default: gpt-4o }\n");
    const first = readCachedConfig();
    expect(first).toEqual({ model: { default: "gpt-4o" } });

    // Now the cache is populated. Second call with allReturn set to
    // the cache contents should return the same shape.
    allReturn = [
      { key: "config.cached_json", value: metaStore.get("config.cached_json")! },
      { key: "config.cached_at", value: metaStore.get("config.cached_at")! },
    ];
    const second = readCachedConfig();
    expect(second).toEqual(first);
  });
});
