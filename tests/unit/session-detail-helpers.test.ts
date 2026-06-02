/**
 * session-detail — unit tests for the pure helpers extracted from
 * /api/sessions/[id] route. The route itself isn't unit-tested here
 * (it's covered by session-detail-running.test.ts through the page, and
 * by manual integration), but the helpers are now the canonical place
 * to test:
 *
 *   - buildSessionData — derives messageCount from messages.length when
 *     omitted, otherwise preserves the explicit value
 *   - findFileWithExtension — tries suffixes in order, returns the first
 *     existing variant or null; "" suffix is the no-extension case
 */

import { buildSessionData, findFileWithExtension } from "@/lib/session-detail";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("buildSessionData", () => {
  it("derives messageCount from messages.length when omitted", () => {
    const result = buildSessionData({
      id: "s1",
      filename: "s1.jsonl",
      format: "jsonl",
      messages: [{ a: 1 }, { b: 2 }, { c: 3 }],
      size: 100,
    });
    expect(result.messageCount).toBe(3);
  });

  it("preserves an explicit messageCount when provided", () => {
    const result = buildSessionData({
      id: "s1",
      filename: "s1.jsonl",
      format: "jsonl",
      messages: [{ a: 1 }, { b: 2 }],
      messageCount: 42,
      size: 100,
    });
    expect(result.messageCount).toBe(42);
  });

  it("preserves all the standardized fields", () => {
    const result = buildSessionData({
      id: "s1",
      filename: "s1.jsonl",
      format: "jsonl",
      title: "My session",
      model: "gpt-4",
      source: "cli",
      messages: [],
      size: 0,
      created: "2026-01-01T00:00:00Z",
      missionId: "m-1",
    });
    expect(result).toEqual({
      id: "s1",
      filename: "s1.jsonl",
      format: "jsonl",
      title: "My session",
      model: "gpt-4",
      source: "cli",
      messages: [],
      messageCount: 0,
      size: 0,
      created: "2026-01-01T00:00:00Z",
      missionId: "m-1",
    });
  });

  it("passes through extra keys (e.g. note for the no-output branch)", () => {
    const result = buildSessionData({
      id: "s1",
      filename: "s1",
      format: "db",
      messages: [],
      size: 0,
      note: "Still running, refresh to check.",
    });
    expect(result.note).toBe("Still running, refresh to check.");
  });
});

describe("findFileWithExtension", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "session-detail-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns the baseName with no suffix when '' is in the list and the raw file exists", () => {
    writeFileSync(join(tmp, "session-1"), "raw");
    const result = findFileWithExtension(tmp, "session-1", ["", ".json", ".jsonl"]);
    expect(result).toBe(join(tmp, "session-1"));
  });

  it("returns .json over .jsonl when both exist (preference order)", () => {
    writeFileSync(join(tmp, "session-1.json"), "{}");
    writeFileSync(join(tmp, "session-1.jsonl"), "{}");
    const result = findFileWithExtension(tmp, "session-1", ["", ".json", ".jsonl"]);
    expect(result).toBe(join(tmp, "session-1.json"));
  });

  it("returns .jsonl when the .json variant doesn't exist", () => {
    writeFileSync(join(tmp, "session-1.jsonl"), "{}");
    const result = findFileWithExtension(tmp, "session-1", ["", ".json", ".jsonl"]);
    expect(result).toBe(join(tmp, "session-1.jsonl"));
  });

  it("returns null when no variant exists", () => {
    // The tmp dir exists but is empty
    expect(existsSync(tmp)).toBe(true);
    const result = findFileWithExtension(tmp, "missing", ["", ".json", ".jsonl"]);
    expect(result).toBeNull();
  });

  it("returns null when the dir itself doesn't exist", () => {
    const missing = join(tmp, "no-such-subdir");
    const result = findFileWithExtension(missing, "session-1", ["", ".json"]);
    expect(result).toBeNull();
  });

  it("tries suffixes in the order given (not alphabetically)", () => {
    // .jsonl first → should return .jsonl, NOT .json
    writeFileSync(join(tmp, "session-1.json"), "{}");
    writeFileSync(join(tmp, "session-1.jsonl"), "{}");
    const result = findFileWithExtension(tmp, "session-1", [".jsonl", ".json"]);
    expect(result).toBe(join(tmp, "session-1.jsonl"));
  });

  it("does not match a prefix that shares a partial suffix (no .jsonl12 vs .jsonl collision)", () => {
    // Adversarial: a sibling file "session-1.jsonl12" must not be returned
    // when we look for "session-1" with the .jsonl suffix. The function
    // joins `${baseName}${ext}` which gives "session-1.jsonl", not
    // "session-1.jsonl12", so this is safe by construction.
    writeFileSync(join(tmp, "session-1.jsonl12"), "noise");
    const result = findFileWithExtension(tmp, "session-1", [".jsonl"]);
    expect(result).toBeNull();
    // Sanity: the noise file is still there
    expect(existsSync(join(tmp, "session-1.jsonl12"))).toBe(true);
  });
});
