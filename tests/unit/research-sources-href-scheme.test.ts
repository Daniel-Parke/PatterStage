/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// The Sources list is the one Deep Research fragment that was NOT safe by
// construction (T-0034, finding 4).
//
// The four dangerouslySetInnerHTML sites all render output from renderers that
// escape at the boundary, which is what the lock-book's `no-unsanitised-html`
// law allows. Reading what actually flows in turned up one exception:
// renderSourcesHtml() escapes the source URL as TEXT and then puts the same
// string in an `href`, where escaping is not the relevant defence. Escaping
// stops an attribute breaking out; it does nothing about the scheme, so a
// `javascript:` URL survives as a clickable link.
//
// The URLs come from the search provider and the pages the loop visited, i.e.
// from the network, and the same function renders the standalone HTML export
// that a user is invited to open and share. `renderInline()` in markdown.ts
// already gets this right by linkifying only `https?://`; this brings the
// sources list to the same rule, and pins it.
//
// Authored before the fix, against the shape the fix has to take: the entry is
// still LISTED (dropping a citation would falsify the report's numbering), it
// is simply not a link.
// ═══════════════════════════════════════════════════════════════

import { renderSourcesHtml } from "@/lib/laboratory/deep-research/report";

const HOSTILE = [
  "javascript:alert(document.cookie)",
  "JaVaScRiPt:alert(1)",
  "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  "vbscript:msgbox(1)",
  // Leading control characters and whitespace are how a scheme filter that
  // trims nothing gets walked past.
  " \t javascript:alert(1)",
];

describe("renderSourcesHtml refuses a non-http(s) scheme", () => {
  it.each(HOSTILE)("does not emit an href for %s", (url) => {
    const html = renderSourcesHtml([url]);
    expect(html).not.toMatch(/href="\s*javascript:/i);
    expect(html).not.toMatch(/href="\s*data:/i);
    expect(html).not.toMatch(/href="\s*vbscript:/i);
  });

  it("still lists the entry, with its number and the text of the URL", () => {
    const html = renderSourcesHtml(["javascript:alert(1)", "https://example.com/a"]);
    // The citation [1] in the prose points at dr-src-1; dropping the row would
    // renumber every citation after it.
    expect(html).toContain('id="dr-src-1"');
    expect(html).toContain('id="dr-src-2"');
    expect(html).toContain("[1]");
    expect(html).toContain("alert(1)");
  });

  it("leaves an ordinary http(s) source clickable", () => {
    const html = renderSourcesHtml(["https://example.com/a?b=1&c=2"]);
    expect(html).toContain('href="https://example.com/a?b=1&amp;c=2"');
    expect(html).toContain("example.com");
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("still escapes the text it renders", () => {
    const html = renderSourcesHtml(['https://example.com/"><script>alert(1)</script>']);
    expect(html).not.toContain("<script>");
  });
});
