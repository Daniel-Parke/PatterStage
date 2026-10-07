/**
 * Unit tests for src/lib/memory/hindsight-bridge.ts — pure response-shaping
 * helpers extracted from the /api/memory/hindsight route.
 */

import {
  mapMemoryItem,
  mapDirectiveItem,
  mapMentalModelItem,
  normalizeTags,
} from "@/lib/memory/hindsight-bridge";

describe("normalizeTags", () => {
  it("returns [] for non-array input", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags("foo")).toEqual([]);
    expect(normalizeTags(42)).toEqual([]);
    expect(normalizeTags({})).toEqual([]);
  });

  it("filters non-string entries", () => {
    expect(normalizeTags(["a", 1, true, null, "b"])).toEqual(["a", "b"]);
  });

  it("trims whitespace and lowercases", () => {
    expect(normalizeTags(["  Foo  ", "BAR", "Baz"])).toEqual(["foo", "bar", "baz"]);
  });

  it("drops empty strings and whitespace-only entries", () => {
    expect(normalizeTags(["", "   ", "ok"])).toEqual(["ok"]);
  });

  it("deduplicates case-insensitively, preserving first occurrence", () => {
    expect(normalizeTags(["Foo", "foo", "FOO", "bar", "Bar"])).toEqual([
      "foo",
      "bar",
    ]);
  });

  it("returns [] for an empty array", () => {
    expect(normalizeTags([])).toEqual([]);
  });
});

describe("mapMemoryItem", () => {
  it("maps text + fact_type + date + proof_count from raw entry", () => {
    expect(
      mapMemoryItem({
        id: "m-1",
        text: "Hermes retained a memory",
        fact_type: "world",
        date: "2026-05-01",
        tags: ["hermes"],
        entities: "Hermes",
        proof_count: 3,
      }),
    ).toEqual({
      id: "m-1",
      content: "Hermes retained a memory",
      type: "world",
      created_at: "2026-05-01",
      tags: ["hermes"],
      entities: "Hermes",
      proofCount: 3,
    });
  });

  it("falls back from text → content", () => {
    expect(mapMemoryItem({ id: "m-2", content: "fallback content" })).toMatchObject({
      id: "m-2",
      content: "fallback content",
    });
  });

  it("uses 'experience' as default type and '' for missing content", () => {
    expect(mapMemoryItem({})).toEqual({
      id: undefined,
      content: "",
      type: "experience",
      created_at: "",
      tags: [],
      entities: "",
      proofCount: 0,
    });
  });

  it("falls back from date → created_at", () => {
    expect(mapMemoryItem({ id: "m-3", created_at: "2026-04-01" })).toMatchObject({
      created_at: "2026-04-01",
    });
  });
});

describe("mapDirectiveItem", () => {
  it("maps a fully-populated directive", () => {
    expect(
      mapDirectiveItem({
        id: "d-1",
        name: "Be concise",
        content: "Always respond in 1-2 sentences.",
        priority: 5,
        is_active: false,
        tags: ["style"],
        created_at: "2026-05-01",
      }),
    ).toEqual({
      id: "d-1",
      name: "Be concise",
      content: "Always respond in 1-2 sentences.",
      priority: 5,
      is_active: false,
      tags: ["style"],
      created_at: "2026-05-01",
    });
  });

  it("defaults is_active to true when missing", () => {
    expect(mapDirectiveItem({ id: "d-2" }).is_active).toBe(true);
  });

  it("defaults all string fields to '' when missing", () => {
    expect(mapDirectiveItem({})).toEqual({
      id: "",
      name: "",
      content: "",
      priority: 0,
      is_active: true,
      tags: [],
      created_at: "",
    });
  });
});

describe("mapMentalModelItem", () => {
  it("maps source_query, last_refreshed_at and the rest", () => {
    expect(
      mapMentalModelItem({
        id: "mm-1",
        name: "Hermes architecture",
        source_query: "How does Hermes dispatch missions?",
        content: "Detailed summary...",
        tags: ["arch"],
        created_at: "2026-05-01",
        last_refreshed_at: "2026-05-15",
      }),
    ).toEqual({
      id: "mm-1",
      name: "Hermes architecture",
      source_query: "How does Hermes dispatch missions?",
      content: "Detailed summary...",
      tags: ["arch"],
      created_at: "2026-05-01",
      last_refreshed_at: "2026-05-15",
    });
  });

  it("defaults all string fields to '' when missing", () => {
    expect(mapMentalModelItem({})).toEqual({
      id: "",
      name: "",
      source_query: "",
      content: "",
      tags: [],
      created_at: "",
      last_refreshed_at: "",
    });
  });
});
