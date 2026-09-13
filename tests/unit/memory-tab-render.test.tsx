/**
 * @jest-environment jsdom
 *
 * Tests for `MemoryTab` — the render fix.
 *
 * Background: the previous `MemoryTab` called `parseMemoryContent`
 * (a regex-based Python `repr()` parser) on `memory.content`. The
 * direct-HTTP bridge (`/api/memory/hindsight?action=list`) returns
 * plain JSON objects, so the parser was a no-op: `text` always fell
 * back to the raw content string, `type` was always "unknown", and
 * `tags` were always empty. The page was throwing client-side
 * (Next.js's error boundary showed "Something went wrong").
 *
 * The fix: `MemoryTab` now reads `memory.content`, `memory.type`,
 * and `memory.tags` directly off the mapped payload from
 * `mapMemoryItem` in `@/lib/memory/hindsight-bridge`. The `parseMemoryContent`
 * helper has been deleted entirely.
 *
 * These tests render the component with a modern mapped payload
 * and assert the expected DOM — if a future commit re-introduces
 * the Python-repr parser or breaks the new direct-field read, the
 * tests fail with a clear diff.
 */

import { render, screen } from "@testing-library/react";
import MemoryTab from "@/components/memory/hindsight/MemoryTab";
import type { Memory } from "@/components/memory/hindsight/types";

import * as fs from "fs";
import * as path from "path";

// ── Mocks ───────────────────────────────────────────────────────

// Avoid jsdom icon rendering and external time/relative-time deps.
jest.mock("lucide-react", () => ({
  Brain: () => <span data-testid="icon-brain" />,
  Clock: () => <span data-testid="icon-clock" />,
  Tag: () => <span data-testid="icon-tag" />,
}));

// Deterministic time-ago output so we can assert exact "5h ago"
// strings instead of "Ns ago" / "just now" depending on test run.
jest.mock("@/lib/utils", () => ({
  timeAgo: (_iso: string) => "5h ago",
}));

// ── Helpers ─────────────────────────────────────────────────────

const renderWithMemories = (memories: Memory[]) =>
  render(
    <MemoryTab
      memories={memories}
      loading={false}
      loadingInitial={false}
    />,
  );

// ── Tests ───────────────────────────────────────────────────────

describe("MemoryTab — renders mapped JSON payload directly", () => {
  it("renders the modern mapped JSON shape (content + type + tags array)", () => {
    const memories: Memory[] = [
      {
        id: "m1",
        content:
          "Depth-2 meta-extraction chains work reliably under JSON constraints.",
        type: "observation",
        tags: ["session:api-cc4c125d27f475eb", "stress-test"],
        created_at: "2026-05-27T00:59:54.723075+00:00",
        proofCount: 1,
      },
    ];
    renderWithMemories(memories);
    // The content renders as-is — no Python `repr()` regex, no
    // `text='...'` substring extraction. The actual prose shows up.
    expect(
      screen.getByText(/Depth-2 meta-extraction chains work reliably/),
    ).toBeInTheDocument();
    // The type badge renders the fact type from the mapped field.
    expect(screen.getByText("observation")).toBeInTheDocument();
    // Each tag is rendered as a separate Badge.
    expect(
      screen.getByText("session:api-cc4c125d27f475eb"),
    ).toBeInTheDocument();
    expect(screen.getByText("stress-test")).toBeInTheDocument();
  });

  it("renders one proof as a proof, not as a fabricated percentage", () => {
    // Amended for T-0101 (D63). This case used to pin
    // `Relevance: 85%` for a fractional value, which the bridge never
    // produced: proof_count was mapped into a field called `score`, and the
    // component's dual-mode branch then rendered every single-proof fact as
    // "Relevance: 100%". The field is `proofCount` now and there is one mode.
    const memories: Memory[] = [
      {
        id: "m2",
        content: "One proof only",
        type: "experience",
        tags: [],
        created_at: "2026-05-27T00:00:00+00:00",
        proofCount: 1,
      },
    ];
    renderWithMemories(memories);
    expect(screen.getByText("Proof count: 1")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Relevance/);
  });

  it("renders the proof count for integer counts (>= 1)", () => {
    const memories: Memory[] = [
      {
        id: "m3",
        content: "Integer proof count",
        type: "experience",
        tags: [],
        created_at: "2026-05-27T00:00:00+00:00",
        proofCount: 3,
      },
    ];
    renderWithMemories(memories);
    expect(screen.getByText("Proof count: 3")).toBeInTheDocument();
  });

  it("defends against non-string array entries in `tags` (does not crash the page)", () => {
    // If a future payload change injects a non-string into `tags`,
    // MemoryTab must filter it out instead of throwing on `.map`
    // over a mixed-type array. The Memory interface declares
    // `tags: unknown` precisely to allow this defence.
    const memories: unknown[] = [
      {
        id: "m4",
        content: "Mixed-type tags array",
        type: "observation",
        tags: ["valid-tag", null, 42, "another-valid", { key: "x" }],
        created_at: "2026-05-27T00:00:00+00:00",
      },
    ];
    // Cast through unknown to bypass the typed `Memory[]` signature —
    // we want to feed in a malformed payload deliberately.
    renderWithMemories(memories as Memory[]);
    expect(screen.getByText("valid-tag")).toBeInTheDocument();
    expect(screen.getByText("another-valid")).toBeInTheDocument();
    // The non-string entries must NOT render as text (which would
    // throw React's "Objects are not valid as a React child" error
    // and trigger the error boundary).
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });

  it("renders the empty-state when no memories are returned", () => {
    renderWithMemories([]);
    expect(screen.getByText("No memories yet")).toBeInTheDocument();
  });

  it("does not render the `unknown` fact-type badge (filter on type === 'unknown')", () => {
    const memories: Memory[] = [
      {
        id: "m5",
        content: "Memory with no type field",
        // type is undefined — should NOT render an "unknown" badge.
        tags: [],
        created_at: "2026-05-27T00:00:00+00:00",
      },
    ];
    renderWithMemories(memories);
    expect(screen.queryByText("unknown")).not.toBeInTheDocument();
  });
});

describe("MemoryTab — anti-pattern locks (parseMemoryContent / parseReflectResponse are dead code)", () => {
  /**
   * Source-pattern locks against the old Python-repr parsers coming
   * back. Same pattern as the chat-page-models-merge.test.ts and
   * the setter-callback test files.
   *
   * We strip comment lines first — the fix's `utils.ts` header
   * documents the removal in prose (so future maintainers know the
   * history), and the test must not match those documentation
   * mentions. Only CODE lines (`import`, `export`, `const`, etc.)
   * are checked.
   */
  function codeOnlySource(filePath: string): string {
    const src = fs.readFileSync(filePath, "utf-8");
    return src
      .split("\n")
      .filter((l: string) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
  }

  it("does not import or call `parseMemoryContent` anywhere in the component tree", () => {
    const files = [
      "src/components/memory/hindsight/MemoryTab.tsx",
      "src/components/memory/hindsight/utils.ts",
      "src/components/memory/HindsightBrowser.tsx",
    ];
    for (const f of files) {
      const code = codeOnlySource(path.join(process.cwd(), f));
      expect(code).not.toMatch(/parseMemoryContent/);
    }
  });

  it("does not import or call `parseReflectResponse` anywhere in the component tree", () => {
    const files = [
      "src/components/memory/hindsight/MemoryTab.tsx",
      "src/components/memory/hindsight/utils.ts",
      "src/components/memory/HindsightBrowser.tsx",
    ];
    for (const f of files) {
      const code = codeOnlySource(path.join(process.cwd(), f));
      expect(code).not.toMatch(/parseReflectResponse/);
    }
  });
});
