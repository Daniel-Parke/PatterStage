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
 *   - dbSessionFields — extracts the 4 shared envelope fields
 *     (title/model/source/created) from a SessionRecord row, with the
 *     same fallback discipline (title → sanitizedId, model → "") as
 *     the pre-refactor inline branches in the route
 *   - parseAssistantLines — splits a mission-output file body into
 *     { index, role: "assistant", content } rows; drops blank lines;
 *     indexes by the *filtered* line position
 */

import {
  buildSessionData,
  dbSessionFields,
  findFileWithExtension,
  parseAssistantLines,
} from "@/lib/sessions/session-detail";
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

describe("dbSessionFields", () => {
  it("returns the envelope fields verbatim when the row is fully populated", () => {
    const result = dbSessionFields(
      {
        title: "My mission",
        modelId: "gpt-4",
        source: "mission",
        startedAt: "2026-06-01T12:00:00Z",
      },
      "s-1",
    );
    expect(result).toEqual({
      title: "My mission",
      model: "gpt-4",
      source: "mission",
      created: "2026-06-01T12:00:00Z",
      // How it ended travels with it now (T-0105, D30); a row that carries
      // none of the three answers with the absent shape rather than omitting
      // the keys, so a caller never has to tell "unknown" from "not sent".
      status: undefined,
      exitCode: null,
      error: null,
    });
  });

  it("falls back title to sanitizedId when title is null (matches pre-refactor inline branch)", () => {
    const result = dbSessionFields(
      { title: null, modelId: "gpt-4", source: "mission", startedAt: "2026-06-01T12:00:00Z" },
      "s-1",
    );
    expect(result.title).toBe("s-1");
  });

  it("falls back title to sanitizedId when title is empty string", () => {
    // The pre-refactor inline branch used `dbSession.title || sanitizedId`
    // which also falls back on empty string (since "" is falsy). The
    // helper preserves that byte-for-byte.
    const result = dbSessionFields(
      { title: "", modelId: "gpt-4", source: "mission", startedAt: "2026-06-01T12:00:00Z" },
      "s-1",
    );
    expect(result.title).toBe("s-1");
  });

  it("falls back model to '' when modelId is null", () => {
    const result = dbSessionFields(
      { title: "x", modelId: null, source: "mission", startedAt: "2026-06-01T12:00:00Z" },
      "s-1",
    );
    expect(result.model).toBe("");
  });

  it("forwards source and created verbatim (created may be null)", () => {
    const result = dbSessionFields(
      { title: "x", modelId: "gpt-4", source: "cron", startedAt: null },
      "s-1",
    );
    expect(result.source).toBe("cron");
    expect(result.created).toBeNull();
  });

  it("derives the four envelope fields the same way for every row shape", () => {
    // The pre-refactor inline form was:
    //   title: dbSession.title || sanitizedId,
    //   model: dbSession.modelId || "",
    //   source: dbSession.source,
    //   created: dbSession.startedAt,
    // The three ending fields joined it in T-0105 (D30) and are asserted by
    // the case above; these four must still be derived the same way.
    const inline = (row: { title: string | null; modelId: string | null; source: string; startedAt: string | null }) => ({
      title: row.title || "s-1",
      model: row.modelId || "",
      source: row.source,
      created: row.startedAt,
    });
    const cases = [
      { title: "A", modelId: "m", source: "cli", startedAt: "2026-01-01T00:00:00Z" },
      { title: null, modelId: "m", source: "mission", startedAt: "2026-01-01T00:00:00Z" },
      { title: "A", modelId: null, source: "cron", startedAt: "2026-01-01T00:00:00Z" },
      { title: "", modelId: "", source: "api", startedAt: null },
      { title: "A", modelId: "m", source: "mission", startedAt: "2026-01-01T00:00:00Z" },
    ];
    for (const row of cases) {
      const { status, exitCode, error, ...envelope } = dbSessionFields(row, "s-1");
      void status;
      void exitCode;
      void error;
      expect(envelope).toEqual(inline(row));
    }
  });
});

describe("parseAssistantLines", () => {
  it("splits content by newlines and tags each as an assistant message", () => {
    const result = parseAssistantLines("hello\nworld");
    expect(result).toEqual([
      { index: 0, role: "assistant", content: "hello" },
      { index: 1, role: "assistant", content: "world" },
    ]);
  });

  it("drops blank lines (empty string, whitespace-only)", () => {
    const result = parseAssistantLines("first\n\n  \nsecond\n");
    expect(result).toEqual([
      { index: 0, role: "assistant", content: "first" },
      { index: 1, role: "assistant", content: "second" },
    ]);
  });

  it("indexes by the *filtered* line position, not the raw line number", () => {
    // Pre-refactor behaviour: `.map((line, i) => ...)` was called on the
    // .filter() output, so the `i` was the position in the filtered array.
    // The helper preserves that — line 0 is the first non-blank line.
    const result = parseAssistantLines("\n\nfirst\n\nsecond\n\n");
    expect(result.map((m) => m.index)).toEqual([0, 1]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseAssistantLines("")).toEqual([]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(parseAssistantLines("   \n\n\t\n  ")).toEqual([]);
  });

  it("preserves line content verbatim (no trimming, no reformatting)", () => {
    // The pre-refactor inline form used `line` (not `line.trim()`) for
    // `content`. The helper preserves that — the trim only happens for
    // the *blank-line filter*, not for the content field.
    const result = parseAssistantLines("  hello  \nworld");
    expect(result[0].content).toBe("  hello  ");
    expect(result[1].content).toBe("world");
  });

  it("is byte-equivalent to the pre-refactor inline form for several input shapes", () => {
    const inline = (content: string) =>
      content
        .split("\n")
        .filter((l) => l.trim())
        .map((line, index) => ({ index, role: "assistant", content: line }));
    const cases = [
      "single line",
      "a\nb\nc",
      "\n\n\n",
      "trailing\n",
      "  whitespace  \n\t\nother",
      "",
    ];
    for (const input of cases) {
      expect(parseAssistantLines(input)).toEqual(inline(input));
    }
  });
});
