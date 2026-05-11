/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");
const initialPath = join(repoRoot, "src", "lib", "db", "migrations", "001_initial_schema.sql");
const missionExtPath = join(repoRoot, "src", "lib", "db", "migrations", "004_mission_extensions.sql");
const statusEnumPath = join(repoRoot, "src", "lib", "db", "migrations", "005_mission_status_enum.sql");
const modelsPath = join(repoRoot, "src", "lib", "db", "migrations", "006_models_credentials.sql");

let testDb: import("better-sqlite3").Database | null = null;

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    db: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

beforeEach(() => {
  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:"
  );
  testDb.pragma("foreign_keys = ON");
  testDb.exec(readFileSync(initialPath, "utf-8"));
  testDb.exec(readFileSync(missionExtPath, "utf-8"));
  testDb.exec(readFileSync(statusEnumPath, "utf-8"));
  testDb.exec(readFileSync(modelsPath, "utf-8"));
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("credentials-repository — CRUD", () => {
  it("listCredentials starts empty", () => {
    const { listCredentials } = require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    expect(listCredentials()).toEqual([]);
  });

  it("createCredential writes label + provider + key + key_hint", () => {
    const { createCredential, getCredentialWithKey } =
      require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    const c = createCredential({
      label: "Anthropic Personal",
      provider: "anthropic",
      apiKey: "sk-ant-abcdefghij1234567890",
    });
    expect(c.label).toBe("Anthropic Personal");
    expect(c.provider).toBe("anthropic");
    expect(c.keyHint).toMatch(/^sk-a/);
    expect(c.keyHint).toMatch(/7890$/);

    // Listing must NOT expose api_key.
    const summary = require("@/lib/credentials-repository").getCredential(c.id);
    expect("apiKey" in (summary as object)).toBe(false);

    // Internal helper must expose the plaintext.
    const withKey = getCredentialWithKey(c.id);
    expect(withKey?.apiKey).toBe("sk-ant-abcdefghij1234567890");
  });

  it("buildKeyHint masks short keys safely", () => {
    const { buildKeyHint } = require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    expect(buildKeyHint("")).toBe("");
    expect(buildKeyHint("ab")).toBe("ab...ab");
    // <=8 chars → 2-prefix/2-suffix to avoid overlap.
    expect(buildKeyHint("abcd1234")).toBe("ab...34");
    expect(buildKeyHint("abcd12345")).toBe("abcd...2345");
    expect(buildKeyHint("sk-this-is-long-enough-to-mask")).toMatch(/^sk-t.*mask$/);
  });

  it("rejects empty label/provider/apiKey", () => {
    const { createCredential } = require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    expect(() => createCredential({ label: "", provider: "x", apiKey: "y" })).toThrow(/label/);
    expect(() => createCredential({ label: "x", provider: "", apiKey: "y" })).toThrow(/provider/);
    expect(() => createCredential({ label: "x", provider: "y", apiKey: "" })).toThrow(/apiKey/);
  });

  it("updateCredential rotates the key only when one is supplied", () => {
    const { createCredential, updateCredential, getCredentialWithKey } =
      require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    const c = createCredential({ label: "X", provider: "anthropic", apiKey: "sk-old-key-12345" });

    // Update label only — key untouched.
    updateCredential(c.id, { label: "Renamed" });
    expect(getCredentialWithKey(c.id)?.apiKey).toBe("sk-old-key-12345");
    expect(getCredentialWithKey(c.id)?.label).toBe("Renamed");

    // Now rotate the key.
    updateCredential(c.id, { apiKey: "sk-new-key-98765" });
    expect(getCredentialWithKey(c.id)?.apiKey).toBe("sk-new-key-98765");
    expect(getCredentialWithKey(c.id)?.keyHint).toMatch(/8765$/);
  });

  it("updateCredential treats empty apiKey as 'do not rotate'", () => {
    const { createCredential, updateCredential, getCredentialWithKey } =
      require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    const c = createCredential({ label: "X", provider: "anthropic", apiKey: "sk-original-12345" });
    updateCredential(c.id, { apiKey: "" });
    expect(getCredentialWithKey(c.id)?.apiKey).toBe("sk-original-12345");
  });

  it("deleteCredential returns true on success and false on miss", () => {
    const { createCredential, deleteCredential } =
      require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    const c = createCredential({ label: "X", provider: "anthropic", apiKey: "sk-x-12345" });
    expect(deleteCredential(c.id)).toBe(true);
    expect(deleteCredential(c.id)).toBe(false);
    expect(deleteCredential("never-existed")).toBe(false);
  });

  it("listCredentials never includes api_key in the row shape", () => {
    const { createCredential, listCredentials } =
      require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    createCredential({ label: "A", provider: "anthropic", apiKey: "sk-secret-1234" });
    createCredential({ label: "B", provider: "openrouter", apiKey: "sk-other-5678" });
    const rows = listCredentials();
    for (const row of rows) {
      expect("apiKey" in row).toBe(false);
      expect(row.keyHint).toMatch(/^sk-/);
    }
  });

  it("upsertCredential returns null for OAuth-only providers (e.g. nous)", () => {
    const { upsertCredential } =
      require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    // Should skip silently — no credential row should be created.
    const result = upsertCredential({ provider: "nous", apiKey: "no-key-needed" });
    expect(result).toBeNull();
  });

  it("upsertCredential works normally for API-key providers", () => {
    const { upsertCredential, listCredentials } =
      require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    const result = upsertCredential({ provider: "minimax", apiKey: "test-key-123" });
    expect(result).not.toBeNull();
    expect(result?.action).toBe("inserted");
    const creds = listCredentials();
    const mm = creds.find((c) => c.provider === "minimax");
    expect(mm).toBeDefined();
    expect(mm?.keyHint).toMatch(/test/);
    expect(mm?.keyHint).toMatch(/123$/);
  });

  it("upsertCredential updates existing row when key changes", () => {
    const { upsertCredential, getCredentialWithKey, listCredentials } =
      require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    upsertCredential({ provider: "openrouter", apiKey: "original-key" });
    const creds = listCredentials();
    const orCred = creds.find((c) => c.provider === "openrouter")!;

    const result = upsertCredential({ provider: "openrouter", apiKey: "rotated-key" });
    expect(result?.action).toBe("updated");
    expect(result?.id).toBe(orCred.id);

    expect(getCredentialWithKey(orCred.id)?.apiKey).toBe("rotated-key");
  });
});
