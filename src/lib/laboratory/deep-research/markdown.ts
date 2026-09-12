// markdown.ts - minimal, SAFE Markdown -> HTML for Deep Research reports.
//
// Zero-dependency renderer tailored to LLM research reports: headings, bold,
// italic, inline code + fences, links, lists, blockquotes, and [n] citations
// (turned into anchors that jump to the Sources panel). All input is HTML-
// escaped first and only a known set of tags is emitted, so the output is safe
// to inject via dangerouslySetInnerHTML / inline into the HTML export.
//
// ── The skim layer (T-0023, warrant WG-WEB-006) ─────────────────────────────
//
// A research report is a long surface read once, so it has to be skimmable and
// deep-linkable, not just readable top to bottom. Three pieces, all produced
// here so the in-app report and the standalone HTML export cannot drift:
//
//   * every heading carries a slugged `id`, so any section has a URL;
//   * `renderReport()` lifts a leading `## In brief` out of the prose, for the
//     caller to render as a band above it;
//   * `renderReport()` reports the `##` headings, for an on-page navigator.
//
// TOLERANCE IS THE POINT. Every report already in someone's database predates
// the In brief section, and the synthesize step is an LLM that will sometimes
// write prose where it was asked for bullets. So the lift is conditional and
// never destructive: unless the section is a leading `## In brief` holding
// bullets and nothing else, it stays in the prose exactly where the model put
// it. A report without one renders as it always did.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Plain-ASCII sentinel (never appears in normal/escaped text) used to protect
// inline code spans from later formatting passes without colliding with digits.
const CODE_OPEN = "@@PSC";
const CODE_CLOSE = "CSP@@";

/** Inline formatting on a single, not-yet-escaped line of text. */
function renderInline(text: string): string {
  let s = escapeHtml(text);
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c) => {
    codes.push(`<code>${c}</code>`);
    return `${CODE_OPEN}${codes.length - 1}${CODE_CLOSE}`;
  });
  // Links [text](url) - only http(s) URLs.
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  // Citations [n] (not part of a link) -> jump to the sources panel.
  s = s.replace(/\[(\d+)\](?!\()/g, (_m, n) => `<a href="#dr-src-${n}" class="dr-cite">[${n}]</a>`);
  // Bold then italic.
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
  // Restore code spans.
  s = s.replace(new RegExp(`${CODE_OPEN}(\\d+)${CODE_CLOSE}`, "g"), (_m, i) => codes[Number(i)] ?? "");
  return s;
}

/** Heading text with the Markdown markers taken off, safe to render as text. */
function plainText(md: string): string {
  return md
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\d+\]/g, " ")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The `id` for a heading. Prefixed so a report anchor can never collide with
 * the `dr-src-N` source anchors, or with an id belonging to the page hosting
 * the report. Output is `[a-z0-9-]` only, so it needs no attribute escaping.
 */
export function slugifyHeading(text: string): string {
  const base = plainText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `dr-h-${base || "section"}`;
}

/** One `##` heading of a report, with the id that was rendered onto it. */
export interface ReportHeading {
  /** Heading text, Markdown markers stripped. Not HTML. */
  text: string;
  /** The `id` on the heading element, for a `#slug` deep link. */
  slug: string;
}

/** A report split into its skim layer and its prose. */
export interface RenderedReport {
  /**
   * The leading `## In brief` bullets as inline HTML, for the band above the
   * prose. Empty for every report that does not carry one, which includes every
   * report written before the section existed.
   */
  inBrief: string[];
  /** The prose HTML, with a lifted In brief section removed. */
  html: string;
  /** Every `##` heading in the prose, in document order. */
  headings: ReportHeading[];
}

/** Render report Markdown to a safe HTML body string. */
export function renderReportHtml(markdown: string): string {
  return renderBody(markdown).html;
}

/**
 * Render a report to its skim layer plus its prose.
 *
 * The headings come back from the same pass that rendered the ids, so a
 * navigator built from them cannot point at an anchor that is not there.
 */
export function renderReport(markdown: string): RenderedReport {
  const { brief, body } = liftInBrief(markdown ?? "");
  const rendered = renderBody(body);
  return { inBrief: brief.map(renderInline), html: rendered.html, headings: rendered.headings };
}

const IN_BRIEF_HEADING = /^#{2,3}\s+in brief\s*:?\s*$/i;

/**
 * Split a leading `## In brief` bullet list off the front of a report.
 *
 * Refuses, and hands the whole document back untouched, unless the section is
 * the report's first heading (one `#` title above it is tolerated) and holds
 * nothing but bullets. Lifting anything looser would silently drop a sentence
 * of a report on its way to the screen, and a skim layer is not worth that.
 */
function liftInBrief(markdown: string): { brief: string[]; body: string } {
  const untouched = { brief: [] as string[], body: markdown };
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    i++;
    while (i < lines.length && lines[i].trim() === "") i++;
  }
  if (i >= lines.length || !IN_BRIEF_HEADING.test(lines[i])) return untouched;

  const start = i;
  const brief: string[] = [];
  i++;
  while (i < lines.length && !/^#{1,6}\s/.test(lines[i])) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }
    const bullet = lines[i].match(/^\s*[-*]\s+(.*)$/);
    if (!bullet) return untouched;
    brief.push(bullet[1]);
    i++;
  }
  if (!brief.length) return untouched;
  return { brief, body: [...lines.slice(0, start), ...lines.slice(i)].join("\n") };
}

function renderBody(markdown: string): { html: string; headings: ReportHeading[] } {
  const lines = (markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const headings: ReportHeading[] = [];
  // Slugs are deduped across every level, not per level: an `h3 Conclusion`
  // under an `h2 Conclusion` would otherwise mint the same anchor twice.
  const usedSlugs = new Map<string, number>();
  let i = 0;
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line.trim())) {
      closeList();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(escapeHtml(lines[i]));
        i++;
      }
      i++;
      out.push(`<pre class="dr-code"><code>${buf.join("\n")}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      const base = slugifyHeading(h[2]);
      const seen = (usedSlugs.get(base) ?? 0) + 1;
      usedSlugs.set(base, seen);
      const slug = seen === 1 ? base : `${base}-${seen}`;
      if (level === 2) headings.push({ text: plainText(h[2]), slug });
      out.push(`<h${level} id="${slug}">${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      closeList();
      out.push(`<blockquote>${renderInline(line.replace(/^>\s?/, ""))}</blockquote>`);
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${renderInline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      i++;
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${renderInline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
      i++;
      continue;
    }

    if (line.trim() === "") {
      closeList();
      i++;
      continue;
    }

    closeList();
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|>\s?|\s*[-*]\s|\s*\d+\.\s|```)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(para.join(" "))}</p>`);
  }
  closeList();
  return { html: out.join("\n"), headings };
}
