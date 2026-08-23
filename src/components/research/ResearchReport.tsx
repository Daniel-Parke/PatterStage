// ═══════════════════════════════════════════════════════════════
// ResearchReport — the in-app interactive Deep Research report
//
// Rendered markdown with clickable [n] citations → a numbered Sources panel,
// plus a collapsible plan→search→reason→synthesize timeline and actions
// (copy, open/download the standalone HTML report). Deep Research is also a
// Composer "research" node kind — Composer orchestrates research, not the
// reverse, so there is no "launch as Composer" action here.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Check, Copy, Download, ExternalLink, Loader2 } from "lucide-react";

import Button from "@/components/ui/Button";
import { renderReport } from "@/lib/laboratory/deep-research/markdown";
import {
  collectSources,
  renderInBriefHtml,
  renderReportNavHtml,
  renderSourcesHtml,
} from "@/lib/laboratory/deep-research/report";
import type { ResearchRun, ResearchStep } from "@/lib/laboratory/deep-research/types";

const STEP_LABEL: Record<string, string> = {
  plan: "Plan",
  search: "Search",
  visit: "Read",
  reason: "Reason",
  synthesize: "Synthesize",
};
const STEP_COLOR: Record<string, string> = {
  plan: "text-neon-purple",
  search: "text-neon-cyan",
  visit: "text-neon-green",
  reason: "text-neon-yellow",
  synthesize: "text-neon-pink",
};
const STEP_DOT: Record<string, string> = {
  plan: "bg-neon-purple",
  search: "bg-neon-cyan",
  visit: "bg-neon-green",
  reason: "bg-neon-yellow",
  synthesize: "bg-neon-pink",
};

// The reading column. WG-WEB-014 rules media a citation IN the reading column,
// which presupposes there is one; an unbounded measure on the longest-form thing
// this app produces is the case the ruling is against. max-w-3xl is not a number
// invented here: it is the measure the tree already holds, on the Story Weaver
// reader (src/modules/rec-room/components/ChapterReader.tsx). The lock-book's
// "Measures" slot is still "set at first build", so the code is the convention.
const PROSE =
  "max-w-3xl text-sm leading-relaxed text-ps-text-primary " +
  "[&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white " +
  "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:scroll-mt-20 [&_h2]:border-b [&_h2]:border-white/10 [&_h2]:pb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white " +
  "[&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-ps-text-primary " +
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 " +
  "[&_a]:text-neon-cyan hover:[&_a]:underline " +
  "[&_code]:rounded [&_code]:bg-dark-800 [&_code]:px-1 [&_code]:text-[0.85em] [&_code]:text-neon-green " +
  "[&_pre.dr-code]:my-3 [&_pre.dr-code]:overflow-x-auto [&_pre.dr-code]:rounded-lg [&_pre.dr-code]:border [&_pre.dr-code]:border-white/10 [&_pre.dr-code]:bg-dark-950 [&_pre.dr-code]:p-3 " +
  "[&_pre.dr-code_code]:bg-transparent [&_pre.dr-code_code]:p-0 [&_pre.dr-code_code]:text-ps-text-secondary " +
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-neon-cyan/50 [&_blockquote]:pl-3 [&_blockquote]:text-ps-text-secondary " +
  "[&_.dr-cite]:font-medium [&_.dr-cite]:text-neon-cyan [&_.dr-cite]:no-underline hover:[&_.dr-cite]:underline";

// The skim layer (T-0023, WG-WEB-006). A research report is read once and it is
// long, so the top of it has to answer the question and the middle of it has to
// be reachable without scrolling for it.
//
// Both bands hold the existing type scale on purpose. A navigator is exactly the
// place a designer reaches for 11px to buy back vertical space, and the
// no-sub-12px-type baseline shrinks only, so the labels are text-xs (12px) and
// the links are text-sm. Fewer sections listed, not smaller ones.
const BRIEF =
  "rounded-xl border border-neon-cyan/25 bg-neon-cyan/5 px-4 py-3 " +
  "[&_.dr-brief-lbl]:mb-2 [&_.dr-brief-lbl]:font-mono [&_.dr-brief-lbl]:text-xs [&_.dr-brief-lbl]:uppercase [&_.dr-brief-lbl]:tracking-widest [&_.dr-brief-lbl]:text-neon-cyan " +
  "[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 " +
  "[&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-ps-text-primary " +
  "[&_a]:text-neon-cyan hover:[&_a]:underline";

const NAV =
  "rounded-xl border border-white/10 bg-dark-900/40 px-4 py-3 " +
  "[&_.dr-nav-lbl]:mb-2 [&_.dr-nav-lbl]:font-mono [&_.dr-nav-lbl]:text-xs [&_.dr-nav-lbl]:uppercase [&_.dr-nav-lbl]:tracking-widest [&_.dr-nav-lbl]:text-ps-text-muted " +
  "[&_ol]:flex [&_ol]:list-none [&_ol]:flex-wrap [&_ol]:gap-x-5 [&_ol]:gap-y-1 [&_ol]:p-0 " +
  "[&_li]:text-sm [&_a]:text-ps-text-secondary hover:[&_a]:text-neon-cyan hover:[&_a]:underline";

const SOURCES =
  "[&_ol.dr-sources]:list-none [&_ol.dr-sources]:space-y-2 [&_ol.dr-sources]:pl-0 " +
  "[&_ol.dr-sources_li]:rounded-lg [&_ol.dr-sources_li]:border [&_ol.dr-sources_li]:border-white/10 [&_ol.dr-sources_li]:bg-dark-900/50 [&_ol.dr-sources_li]:p-2.5 [&_ol.dr-sources_li]:scroll-mt-20 " +
  "[&_.n]:font-semibold [&_.n]:text-neon-cyan [&_a]:text-ps-text-primary hover:[&_a]:text-neon-cyan [&_.u]:mt-0.5 [&_.u]:break-all [&_.u]:text-xs [&_.u]:text-ps-text-muted";

export default function ResearchReport({ run, steps }: { run: ResearchRun; steps: ResearchStep[] }) {
  const [copied, setCopied] = useState(false);

  const sources = collectSources(steps);
  // A report from before the In brief section existed comes back with an empty
  // band and, if it is short, an empty navigator. Both render as nothing.
  const report = run.report ? renderReport(run.report) : null;
  const briefHtml = report ? renderInBriefHtml(report.inBrief) : "";
  const navHtml = report ? renderReportNavHtml(report.headings) : "";

  async function copy() {
    if (!run.report) return;
    await navigator.clipboard.writeText(run.report);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-5">
      {/* Actions */}
      {run.status === "completed" && run.report ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" color="cyan" size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <a href={`/api/laboratory/research/${run.id}/export`} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" color="cyan" size="sm">
              <ExternalLink className="h-4 w-4" /> View report
            </Button>
          </a>
          <a href={`/api/laboratory/research/${run.id}/export`} download={`research-${run.id.slice(0, 8)}.html`}>
            <Button variant="secondary" color="green" size="sm">
              <Download className="h-4 w-4" /> Download
            </Button>
          </a>
        </div>
      ) : null}

      {/* Skim layer: the In brief band, then the navigator, then the prose. */}
      {briefHtml ? (
        /* design-lint-disable-next-line no-unsanitised-html -- renderInBriefHtml only wraps bullets that renderReport produced, escaped at the Markdown boundary by the same renderer as the prose below. */
        <div className={BRIEF} dangerouslySetInnerHTML={{ __html: briefHtml }} />
      ) : null}
      {navHtml ? (
        /* design-lint-disable-next-line no-unsanitised-html -- renderReportNavHtml emits only escaped heading text and the slugs it was given, no model HTML. */
        <div className={NAV} dangerouslySetInnerHTML={{ __html: navHtml }} />
      ) : null}

      {/* Report */}
      {report ? (
        <div className={PROSE} dangerouslySetInnerHTML={{ __html: report.html }} />
      ) : run.status === "running" || run.status === "pending" ? (
        <div className="flex items-center gap-2 text-sm text-ps-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Researching…
        </div>
      ) : null}

      {/* Sources */}
      {sources.length ? (
        <div>
          <h3 className="mb-2 text-xs font-mono uppercase tracking-widest text-ps-text-muted">
            Sources ({sources.length})
          </h3>
          <div className={SOURCES} dangerouslySetInnerHTML={{ __html: renderSourcesHtml(sources) }} />
        </div>
      ) : null}

      {/* Timeline — a flowing plan → search → read → reason → synthesize stepper.
          While the run is live the rail "electrifies" and a working head pulses. */}
      {steps.length ? (
        <div>
          <h3 className="mb-2 text-xs font-mono uppercase tracking-widest text-ps-text-muted">
            Research timeline
          </h3>
          <ol className="relative space-y-2">
            {steps.map((s, i) => {
              const running = run.status === "running";
              const isLast = i === steps.length - 1;
              const active = running && isLast;
              const showRail = !isLast || running;
              return (
                <li key={s.id} className="relative pl-7">
                  {showRail ? (
                    <span
                      className={`absolute left-[9px] top-5 h-full ${active ? "ps-rail-flow w-0.5" : "w-px bg-white/10"}`}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`absolute left-1 top-3 h-3.5 w-3.5 rounded-full ring-2 ring-dark-900 ${STEP_DOT[s.kind] ?? "bg-white/30"} ${active ? "animate-pulse" : ""}`}
                    aria-hidden
                  />
                  <details open={active} className="rounded-lg border border-white/10 bg-dark-900/40">
                    <summary className="cursor-pointer list-none px-3 py-2 text-xs">
                      <span className={`font-mono uppercase tracking-wider ${STEP_COLOR[s.kind] ?? "text-ps-text-secondary"}`}>
                        {STEP_LABEL[s.kind] ?? s.kind}
                      </span>
                      {s.input ? <span className="ml-2 text-ps-text-muted">{s.input.slice(0, 70)}</span> : null}
                    </summary>
                    {s.output ? (
                      <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap px-3 pb-3 text-xs text-ps-text-muted">
                        {s.output}
                      </pre>
                    ) : null}
                  </details>
                </li>
              );
            })}
            {run.status === "running" ? (
              <li className="relative pl-7">
                <span className="absolute left-1 top-1.5 h-3.5 w-3.5 animate-pulse rounded-full bg-neon-cyan/60 ring-2 ring-dark-900" aria-hidden />
                <span className="inline-flex items-center gap-2 text-xs text-ps-text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> working…
                </span>
              </li>
            ) : null}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
