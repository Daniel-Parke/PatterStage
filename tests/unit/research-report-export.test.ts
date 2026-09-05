/** @jest-environment node */
// Deep Research source collection + the standalone interactive HTML export.

import {
  collectSources,
  renderSourcesHtml,
  buildExportHtml,
  renderInBriefHtml,
  renderReportNavHtml,
  NAV_MIN_HEADINGS,
} from "@/lib/laboratory/deep-research/report";
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
  // Fixtures predate migration 034: null is the honest value for a run
  // whose token usage was never recorded (T-0030).
  usage: null,
  // T-0070: unmeasured, exactly as a pre-036 run is.
  gather: null,
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

  it("renders the In brief band and the navigator above the prose", () => {
    const long = {
      ...run,
      report:
        "## In brief\n\n- Point one [1]\n- Point two\n- Point three\n\n" +
        "## Executive summary\n\na\n\n## Key findings\n\nb\n\n" +
        "## Evidence\n\nc\n\n## Conclusion\n\nd\n",
    };
    const html = buildExportHtml(long, [step("synthesize", ["https://x.test"])]);
    expect(html).toContain('class="dr-brief"');
    expect(html).toContain("Point one");
    expect(html).toContain('class="dr-nav"');
    // The navigator's links match the ids the prose actually rendered.
    expect(html).toContain('<a href="#dr-h-key-findings">Key findings</a>');
    expect(html).toContain('<h2 id="dr-h-key-findings">');
    // Band and navigator lead the prose, so the page opens on the skim layer.
    expect(html.indexOf('class="dr-brief"')).toBeLessThan(html.indexOf('class="dr-nav"'));
    expect(html.indexOf('class="dr-nav"')).toBeLessThan(html.indexOf('<div class="report">'));
  });

  it("renders an older report, with no In brief and too few headings, unchanged", () => {
    const html = buildExportHtml(run, [step("synthesize", ["https://x.test"])]);
    // The stylesheet always carries the rules; what must be absent is the markup.
    expect(html).not.toContain('class="dr-brief"');
    expect(html).not.toContain('class="dr-nav"');
    expect(html).toContain("SQLite is great for single-node apps");
  });
});

describe("renderInBriefHtml", () => {
  it("renders nothing for a report with no In brief", () => {
    expect(renderInBriefHtml([])).toBe("");
  });

  it("passes the renderer's inline HTML straight through", () => {
    const html = renderInBriefHtml(['A point <a href="#dr-src-1" class="dr-cite">[1]</a>']);
    expect(html).toContain('<li>A point <a href="#dr-src-1" class="dr-cite">[1]</a></li>');
    expect(html).toContain('aria-label="In brief"');
  });
});

describe("renderReportNavHtml", () => {
  const headings = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ text: `Section ${i}`, slug: `dr-h-section-${i}` }));

  it(`stays out of the way below ${NAV_MIN_HEADINGS} headings`, () => {
    expect(renderReportNavHtml(headings(NAV_MIN_HEADINGS - 1))).toBe("");
  });

  it(`appears at ${NAV_MIN_HEADINGS} headings`, () => {
    const html = renderReportNavHtml(headings(NAV_MIN_HEADINGS));
    expect(html).toContain('aria-label="On this page"');
    expect(html).toContain('<a href="#dr-h-section-0">Section 0</a>');
  });

  it("escapes heading text into the link", () => {
    const html = renderReportNavHtml(
      headings(NAV_MIN_HEADINGS - 1).concat({ text: 'a <b> "c"', slug: "dr-h-a-b-c" }),
    );
    expect(html).toContain("&lt;b&gt; &quot;c&quot;");
    expect(html).not.toContain("<b>");
  });
});
