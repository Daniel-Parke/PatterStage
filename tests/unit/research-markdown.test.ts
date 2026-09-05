/** @jest-environment node */
// The in-house research Markdown renderer: safe HTML + clickable [n] citations.

import {
  renderReport,
  renderReportHtml,
  slugifyHeading,
} from "@/lib/laboratory/deep-research/markdown";

describe("renderReportHtml", () => {
  it("renders headings, bold, and paragraphs", () => {
    const html = renderReportHtml("# Title\n\nSome **bold** text.");
    expect(html).toContain('<h1 id="dr-h-title">Title</h1>');
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<p>Some <strong>bold</strong> text.</p>");
  });

  it("turns [n] citations into anchors to the sources panel", () => {
    const html = renderReportHtml("SQLite is fine for small apps [1] but Postgres scales [2].");
    expect(html).toContain('<a href="#dr-src-1" class="dr-cite">[1]</a>');
    expect(html).toContain('<a href="#dr-src-2" class="dr-cite">[2]</a>');
  });

  it("escapes HTML (no injection)", () => {
    const html = renderReportHtml("a <script>alert(1)</script> b");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders inline code without mangling digits", () => {
    const html = renderReportHtml("run `npm run build` then wait 30 seconds");
    expect(html).toContain("<code>npm run build</code>");
    expect(html).toContain("wait 30 seconds");
  });

  it("renders unordered + ordered lists and links", () => {
    const html = renderReportHtml("- one\n- two\n\n1. first\n2. second\n\nSee [docs](https://x.test).");
    expect(html).toContain("<ul>\n<li>one</li>\n<li>two</li>\n</ul>");
    expect(html).toContain("<ol>\n<li>first</li>\n<li>second</li>\n</ol>");
    expect(html).toContain('<a href="https://x.test" target="_blank" rel="noopener noreferrer">docs</a>');
  });

  it("renders a fenced code block", () => {
    const html = renderReportHtml("```\nconst x = 1 < 2;\n```");
    expect(html).toContain('<pre class="dr-code"><code>const x = 1 &lt; 2;</code></pre>');
  });
});

// ── The skim layer (T-0023) ─────────────────────────────────────────────────

describe("slugifyHeading", () => {
  it("makes a URL-safe, prefixed id", () => {
    expect(slugifyHeading("Key findings")).toBe("dr-h-key-findings");
  });

  it("strips Markdown markers and citations from the id", () => {
    expect(slugifyHeading("**Evidence** & `analysis` [3]")).toBe("dr-h-evidence-analysis");
  });

  it("never returns a bare prefix for a heading with no word characters", () => {
    expect(slugifyHeading("***")).toBe("dr-h-section");
  });
});

describe("renderReportHtml headings", () => {
  it("puts a slugged id on every heading so a section can be deep-linked", () => {
    const html = renderReportHtml("## Key findings\n\ntext\n\n### Open questions");
    expect(html).toContain('<h2 id="dr-h-key-findings">Key findings</h2>');
    expect(html).toContain('<h3 id="dr-h-open-questions">Open questions</h3>');
  });

  it("keeps repeated headings unique, across levels", () => {
    const html = renderReportHtml("## Conclusion\n\n### Conclusion\n\n## Conclusion");
    expect(html).toContain('<h2 id="dr-h-conclusion">');
    expect(html).toContain('<h3 id="dr-h-conclusion-2">');
    expect(html).toContain('<h2 id="dr-h-conclusion-3">');
  });
});

describe("renderReport", () => {
  const report =
    "## In brief\n\n- SQLite wins on ops [1]\n- Postgres wins on concurrency [2]\n- Either is fine under 10 rps\n\n" +
    "## Executive summary\n\nBoth work.\n\n## Key findings\n\nDetail.\n";

  it("lifts a leading In brief out of the prose, keeping citations clickable", () => {
    const r = renderReport(report);
    expect(r.inBrief).toHaveLength(3);
    expect(r.inBrief[0]).toContain('<a href="#dr-src-1" class="dr-cite">[1]</a>');
    expect(r.html).not.toContain("In brief");
    expect(r.html).toContain('<h2 id="dr-h-executive-summary">');
  });

  it("reports the h2s, in order, with the ids actually rendered", () => {
    const r = renderReport(report);
    expect(r.headings).toEqual([
      { text: "Executive summary", slug: "dr-h-executive-summary" },
      { text: "Key findings", slug: "dr-h-key-findings" },
    ]);
    for (const h of r.headings) expect(r.html).toContain(`id="${h.slug}"`);
  });

  it("tolerates a report with no In brief at all (every older report)", () => {
    const r = renderReport("## Executive summary\n\nJust prose.\n");
    expect(r.inBrief).toEqual([]);
    expect(r.html).toContain("Just prose.");
    expect(r.headings).toHaveLength(1);
  });

  it("tolerates an empty report", () => {
    const r = renderReport("");
    expect(r).toEqual({ inBrief: [], html: "", headings: [] });
  });

  it("lifts an In brief that sits under a title line", () => {
    const r = renderReport("# SQLite vs Postgres\n\n## In brief\n\n- One point\n\n## Body\n\nx");
    expect(r.inBrief).toEqual(["One point"]);
    expect(r.html).toContain("<h1 id=\"dr-h-sqlite-vs-postgres\">");
  });

  it("leaves the section alone when it is not the leading one", () => {
    const r = renderReport("## Summary\n\ntext\n\n## In brief\n\n- a point\n");
    expect(r.inBrief).toEqual([]);
    expect(r.html).toContain("In brief");
  });

  it("refuses to lift a section that is not purely bullets, rather than drop prose", () => {
    const r = renderReport("## In brief\n\nHere is the gist:\n\n- a point\n\n## Body\n\nx");
    expect(r.inBrief).toEqual([]);
    expect(r.html).toContain("Here is the gist:");
    expect(r.html).toContain("a point");
  });

  it("refuses to lift an In brief with no bullets under it", () => {
    const r = renderReport("## In brief\n\n## Body\n\nx");
    expect(r.inBrief).toEqual([]);
    expect(r.html).toContain("In brief");
  });
});
