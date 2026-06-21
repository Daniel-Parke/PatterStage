/** @jest-environment node */
// The in-house research Markdown renderer: safe HTML + clickable [n] citations.

import { renderReportHtml } from "@/lib/laboratory/deep-research/markdown";

describe("renderReportHtml", () => {
  it("renders headings, bold, and paragraphs", () => {
    const html = renderReportHtml("# Title\n\nSome **bold** text.");
    expect(html).toContain("<h1>Title</h1>");
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
