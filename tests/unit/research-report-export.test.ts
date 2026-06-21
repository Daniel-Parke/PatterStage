/** @jest-environment node */
// Deep Research source collection + the standalone interactive HTML export.

import { collectSources, renderSourcesHtml, buildExportHtml } from "@/lib/laboratory/deep-research/report";
import type { ResearchRun, ResearchStep } from "@/lib/laboratory/deep-research/types";

function step(kind: ResearchStep["kind"], sources: string[]): ResearchStep {
  return { id: kind, runId: "r1", position: 0, kind, input: null, output: `${kind} output`, sources, createdAt: "" };
}

const run: ResearchRun = {
  id: "run-abcdef12",
  query: "SQLite vs Postgres for a self-hosted app?",
  status: "completed",
  provider: "duckduckgo",
  modelId: null,
  config: { searchProvider: "duckduckgo", rounds: 3 },
  report: "## Verdict\n\nSQLite is great for single-node apps [1]; Postgres scales out [2].",
  error: null,
  createdAt: "",
  completedAt: "2026-06-21T00:00:00Z",
};

describe("collectSources", () => {
  it("prefers the synthesize step's citation-ordered sources", () => {
    const steps = [
      step("search", ["https://a.test", "https://b.test"]),
      step("synthesize", ["https://x.test", "https://y.test"]),
    ];
    expect(collectSources(steps)).toEqual(["https://x.test", "https://y.test"]);
  });

  it("falls back to the deduped union when there is no synthesize step", () => {
    const steps = [step("search", ["https://a.test", "https://a.test"]), step("reason", ["https://b.test"])];
    expect(collectSources(steps)).toEqual(["https://a.test", "https://b.test"]);
  });
});

describe("renderSourcesHtml", () => {
  it("numbers + anchors each source for citation jumps", () => {
    const html = renderSourcesHtml(["https://example.com/page"]);
    expect(html).toContain('id="dr-src-1"');
    expect(html).toContain("[1]");
    expect(html).toContain("example.com");
  });
});

describe("buildExportHtml", () => {
  it("produces a self-contained HTML doc with the report, citations + sources", () => {
    const steps = [step("plan", []), step("synthesize", ["https://x.test", "https://y.test"])];
    const html = buildExportHtml(run, steps);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("<style>"); // inline CSS, no external assets
    expect(html).toContain("SQLite vs Postgres"); // query in the header
    expect(html).toContain('<a href="#dr-src-1" class="dr-cite">[1]</a>'); // clickable citation
    expect(html).toContain('id="dr-src-1"'); // matching source anchor
    expect(html).toContain("Research timeline"); // step timeline
  });
});
