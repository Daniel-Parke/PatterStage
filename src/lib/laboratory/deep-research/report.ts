// ═══════════════════════════════════════════════════════════════
// deep-research/report.ts — sources collection + standalone HTML export
//
// collectSources() yields the citation-ordered source list (the synthesize
// step's sources, else the deduped union). buildExportHtml() renders a single,
// self-contained, themed HTML page (report + clickable citations + sources +
// timeline) — the shareable "cool HTML page".
//
// This file is also where HTML shared by the in-app report and the export
// lives: the sources list, the In brief band and the on-page navigator. One
// producer per fragment, styled twice (Tailwind in the app, the inline
// stylesheet below in the export), because a skim layer that is only in one of
// the two surfaces is a skim layer a reader cannot rely on.
// ═══════════════════════════════════════════════════════════════

import { renderReport, type ReportHeading } from "./markdown";
import type { ResearchRun, ResearchStep } from "./types";

/** Citation-ordered source URLs for a run's steps. */
export function collectSources(steps: ResearchStep[]): string[] {
  const synth = steps.find((s) => s.kind === "synthesize");
  if (synth && synth.sources.length) return synth.sources;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of steps) {
    for (const url of s.sources) {
      if (!seen.has(url)) {
        seen.add(url);
        out.push(url);
      }
    }
  }
  return out;
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The URL, but only if following it is navigation.
 *
 * escAttr() stops a value breaking OUT of an attribute; it has nothing to say
 * about what the attribute then means. `href="javascript:alert(1)"` is
 * perfectly well-formed HTML and perfectly escaped, and it still runs on click.
 * These URLs come off the network (the search provider's results and the pages
 * the research loop visited) and the same list is written into the standalone
 * export a user is invited to open and share, so the scheme is checked here
 * rather than assumed.
 *
 * renderInline() in markdown.ts already applies this rule to links in the prose
 * by linkifying only `https?://`. This is the sources list catching up
 * (T-0034). Returns null for anything that is not http or https, including a
 * URL that does not parse at all; the caller still LISTS the entry, because the
 * citations in the prose are numbered against this list and dropping a row
 * would renumber every citation after it.
 */
function navigableHref(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url.trim() : null;
  } catch {
    return null;
  }
}

/** Render the numbered, anchored Sources list HTML (shared by page + export). */
export function renderSourcesHtml(sources: string[]): string {
  if (!sources.length) return "";
  const items = sources
    .map((url, i) => {
      const href = navigableHref(url);
      // A source that is not navigable is still a source: it keeps its number
      // and its text, it simply is not a link.
      const label = href
        ? `<a href="${escAttr(href)}" target="_blank" rel="noopener noreferrer">${escAttr(hostOf(url))}</a>`
        : `<span class="h">${escAttr(hostOf(url))}</span>`;
      return `<li id="dr-src-${i + 1}"><span class="n">[${i + 1}]</span> ${label}<div class="u">${escAttr(url)}</div></li>`;
    })
    .join("\n");
  return `<ol class="dr-sources">\n${items}\n</ol>`;
}

/**
 * The skim band: the report's In brief bullets, rendered above the prose.
 *
 * Items arrive as inline HTML from the Markdown renderer, which escaped them at
 * the boundary, so citations stay clickable in the band instead of degrading to
 * a literal "[3]". Empty string for a report with no In brief, which the
 * callers drop entirely rather than render an empty box.
 */
export function renderInBriefHtml(items: string[]): string {
  if (!items.length) return "";
  const lis = items.map((html) => `<li>${html}</li>`).join("\n");
  return `<aside class="dr-brief" aria-label="In brief"><p class="dr-brief-lbl">In brief</p><ul>\n${lis}\n</ul></aside>`;
}

/**
 * Below this many `##` headings a report is short enough to scan by scrolling,
 * and a navigator is furniture. At or above it the navigator is the cheapest
 * way to reach section four.
 */
export const NAV_MIN_HEADINGS = 4;

/** The on-page navigator, or "" when the report is short enough not to need one. */
export function renderReportNavHtml(headings: ReportHeading[]): string {
  if (headings.length < NAV_MIN_HEADINGS) return "";
  const items = headings
    .map((h) => `<li><a href="#${h.slug}">${escAttr(h.text)}</a></li>`)
    .join("\n");
  return `<nav class="dr-nav" aria-label="On this page"><p class="dr-nav-lbl">On this page</p><ol>\n${items}\n</ol></nav>`;
}

const STEP_LABEL: Record<string, string> = {
  plan: "Plan",
  search: "Search",
  visit: "Read",
  reason: "Reason",
  synthesize: "Synthesize",
};

/** A self-contained, themed HTML document for a completed research run. */
export function buildExportHtml(run: ResearchRun, steps: ResearchStep[]): string {
  const sources = collectSources(steps);
  const rendered = run.report ? renderReport(run.report) : null;
  const body = rendered ? rendered.html : "<p><em>No report.</em></p>";
  const briefHtml = rendered ? renderInBriefHtml(rendered.inBrief) : "";
  const navHtml = rendered ? renderReportNavHtml(rendered.headings) : "";
  const sourcesHtml = renderSourcesHtml(sources);
  const cfg = run.config ?? {};
  const meta = [
    run.modelId ? `Model: ${escAttr(run.modelId)}` : "Model: agent default",
    `Search: ${escAttr(run.provider ?? cfg.searchProvider ?? "duckduckgo")}`,
    cfg.rounds ? `Depth: ${cfg.rounds} rounds` : null,
    run.completedAt ? `Completed: ${escAttr(run.completedAt)}` : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");
  const timeline = steps
    .map(
      (s) =>
        `<details class="dr-step"><summary><span class="k">${STEP_LABEL[s.kind] ?? s.kind}</span>${s.input ? ` <span class="i">${escAttr(s.input).slice(0, 80)}</span>` : ""}</summary><pre>${escAttr(s.output ?? "")}</pre></details>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escAttr(run.query).slice(0, 80)} — PatterStage Deep Research</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0a0e1a; color: #e7ecf3; font: 16px/1.65 -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 48px 24px 96px; }
  .eyebrow { font: 600 11px/1 ui-monospace, monospace; letter-spacing: .15em; text-transform: uppercase; color: #5eead4; }
  h1.q { font-size: 26px; line-height: 1.25; margin: 10px 0 6px; }
  .meta { color: #8b97a8; font-size: 13px; margin-bottom: 32px; }
  h1,h2,h3,h4 { line-height: 1.3; margin: 1.6em 0 .5em; scroll-margin-top: 24px; }
  h2 { font-size: 20px; border-bottom: 1px solid #1b2436; padding-bottom: .3em; }
  h3 { font-size: 17px; }
  p { margin: .8em 0; } a { color: #67e8f9; } a:hover { color: #a5f3fc; }
  ul, ol { padding-left: 1.4em; } li { margin: .3em 0; }
  code { background: #131a2a; border: 1px solid #1b2436; border-radius: 4px; padding: .1em .35em; font: 13px ui-monospace, monospace; }
  pre.dr-code { background: #0d1320; border: 1px solid #1b2436; border-radius: 8px; padding: 14px; overflow-x: auto; }
  pre.dr-code code { background: none; border: none; padding: 0; }
  blockquote { border-left: 3px solid #2dd4bf; margin: .8em 0; padding: .2em 0 .2em 1em; color: #aeb9c9; }
  .dr-cite { font-size: .85em; color: #5eead4; text-decoration: none; padding: 0 1px; } .dr-cite:hover { text-decoration: underline; }
  .dr-brief { background: #0d1b23; border: 1px solid #164e52; border-left: 3px solid #2dd4bf; border-radius: 10px; padding: 16px 20px; margin: 0 0 20px; }
  .dr-brief-lbl { font: 600 12px/1 ui-monospace, monospace; letter-spacing: .15em; text-transform: uppercase; color: #5eead4; margin: 0 0 10px; }
  .dr-brief ul { margin: 0; padding-left: 1.2em; } .dr-brief li { margin: .35em 0; }
  .dr-nav { border: 1px solid #1b2436; border-radius: 10px; padding: 12px 16px; margin: 0 0 28px; }
  .dr-nav-lbl { font: 600 12px/1 ui-monospace, monospace; letter-spacing: .15em; text-transform: uppercase; color: #8b97a8; margin: 0 0 8px; }
  .dr-nav ol { display: flex; flex-wrap: wrap; gap: 4px 20px; list-style: none; margin: 0; padding: 0; font-size: 14px; }
  .dr-nav a { color: #aeb9c9; text-decoration: none; } .dr-nav a:hover { color: #67e8f9; text-decoration: underline; }
  .section { margin-top: 48px; }
  .section > h2.lbl { font: 600 12px/1 ui-monospace, monospace; letter-spacing: .15em; text-transform: uppercase; color: #8b97a8; border: none; padding: 0; }
  ol.dr-sources { list-style: none; padding: 0; } ol.dr-sources li { background: #0f1626; border: 1px solid #1b2436; border-radius: 8px; padding: 10px 12px; margin: 8px 0; }
  ol.dr-sources .n { color: #5eead4; font-weight: 600; } ol.dr-sources .u { color: #6b7688; font-size: 12px; word-break: break-all; margin-top: 2px; }
  ol.dr-sources .h { color: #aeb9c9; }
  .dr-step { background: #0f1626; border: 1px solid #1b2436; border-radius: 8px; margin: 6px 0; padding: 8px 12px; }
  .dr-step summary { cursor: pointer; } .dr-step .k { color: #67e8f9; font: 600 11px/1 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .1em; }
  .dr-step .i { color: #8b97a8; font-size: 12px; } .dr-step pre { white-space: pre-wrap; color: #aeb9c9; font-size: 13px; margin: 8px 0 0; }
  .foot { margin-top: 64px; color: #6b7688; font-size: 12px; text-align: center; }
</style></head>
<body><div class="wrap">
  <div class="eyebrow">PatterStage &middot; Deep Research</div>
  <h1 class="q">${escAttr(run.query)}</h1>
  <div class="meta">${meta}</div>
  ${briefHtml}
  ${navHtml}
  <div class="report">${body}</div>
  ${sourcesHtml ? `<div class="section"><h2 class="lbl">Sources</h2>${sourcesHtml}</div>` : ""}
  ${timeline ? `<div class="section"><h2 class="lbl">Research timeline</h2>${timeline}</div>` : ""}
  <div class="foot">Generated by PatterStage Deep Research</div>
</div></body></html>`;
}
