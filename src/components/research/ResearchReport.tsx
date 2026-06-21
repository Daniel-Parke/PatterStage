// ═══════════════════════════════════════════════════════════════
// ResearchReport — the in-app interactive Deep Research report
//
// Rendered markdown with clickable [n] citations → a numbered Sources panel,
// plus a collapsible plan→search→reason→synthesize timeline and actions
// (copy, download standalone HTML, launch as a Composer workflow).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Check, Copy, Download, GitBranch, Loader2 } from "lucide-react";

import Button from "@/components/ui/Button";
import { safeApiCall } from "@/lib/api-fetch";
import { renderReportHtml } from "@/lib/laboratory/deep-research/markdown";
import { collectSources, renderSourcesHtml } from "@/lib/laboratory/deep-research/report";
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

const PROSE =
  "text-sm leading-relaxed text-white/80 " +
  "[&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white " +
  "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-white/10 [&_h2]:pb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white " +
  "[&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-white/90 " +
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 " +
  "[&_a]:text-neon-cyan hover:[&_a]:underline " +
  "[&_code]:rounded [&_code]:bg-dark-800 [&_code]:px-1 [&_code]:text-[0.85em] [&_code]:text-neon-green " +
  "[&_pre.dr-code]:my-3 [&_pre.dr-code]:overflow-x-auto [&_pre.dr-code]:rounded-lg [&_pre.dr-code]:border [&_pre.dr-code]:border-white/10 [&_pre.dr-code]:bg-dark-950 [&_pre.dr-code]:p-3 " +
  "[&_pre.dr-code_code]:bg-transparent [&_pre.dr-code_code]:p-0 [&_pre.dr-code_code]:text-white/70 " +
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-neon-cyan/50 [&_blockquote]:pl-3 [&_blockquote]:text-white/60 " +
  "[&_.dr-cite]:font-medium [&_.dr-cite]:text-neon-cyan [&_.dr-cite]:no-underline hover:[&_.dr-cite]:underline";

const SOURCES =
  "[&_ol.dr-sources]:list-none [&_ol.dr-sources]:space-y-2 [&_ol.dr-sources]:pl-0 " +
  "[&_ol.dr-sources_li]:rounded-lg [&_ol.dr-sources_li]:border [&_ol.dr-sources_li]:border-white/10 [&_ol.dr-sources_li]:bg-dark-900/50 [&_ol.dr-sources_li]:p-2.5 [&_ol.dr-sources_li]:scroll-mt-20 " +
  "[&_.n]:font-semibold [&_.n]:text-neon-cyan [&_a]:text-white/80 hover:[&_a]:text-neon-cyan [&_.u]:mt-0.5 [&_.u]:break-all [&_.u]:text-[11px] [&_.u]:text-white/30";

export default function ResearchReport({ run, steps }: { run: ResearchRun; steps: ResearchStep[] }) {
  const [copied, setCopied] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchMsg, setLaunchMsg] = useState("");

  const sources = collectSources(steps);

  async function copy() {
    if (!run.report) return;
    await navigator.clipboard.writeText(run.report);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function launchAsComposer() {
    setLaunching(true);
    setLaunchMsg("");
    try {
      const res = await safeApiCall(`/api/laboratory/research/${run.id}/launch`, { method: "POST" });
      setLaunchMsg(res.ok ? "Launched a Composer workflow from this report." : res.error ?? "Launch failed");
    } finally {
      setLaunching(false);
    }
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
          <a href={`/api/laboratory/research/${run.id}/export`} download>
            <Button variant="secondary" color="green" size="sm">
              <Download className="h-4 w-4" /> Export HTML
            </Button>
          </a>
          <Button variant="secondary" color="purple" size="sm" loading={launching} onClick={() => void launchAsComposer()}>
            {!launching ? <GitBranch className="h-4 w-4" /> : null} Launch as Composer
          </Button>
          {launchMsg ? <span className="text-xs text-white/40">{launchMsg}</span> : null}
        </div>
      ) : null}

      {/* Report */}
      {run.report ? (
        <div className={PROSE} dangerouslySetInnerHTML={{ __html: renderReportHtml(run.report) }} />
      ) : run.status === "running" || run.status === "pending" ? (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" /> Researching…
        </div>
      ) : null}

      {/* Sources */}
      {sources.length ? (
        <div>
          <h3 className="mb-2 text-[11px] font-mono uppercase tracking-widest text-white/40">
            Sources ({sources.length})
          </h3>
          <div className={SOURCES} dangerouslySetInnerHTML={{ __html: renderSourcesHtml(sources) }} />
        </div>
      ) : null}

      {/* Timeline */}
      {steps.length ? (
        <div>
          <h3 className="mb-2 text-[11px] font-mono uppercase tracking-widest text-white/40">
            Research timeline
          </h3>
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="rounded-lg border border-white/10 bg-dark-900/40">
                <details>
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs">
                    <span className={`font-mono uppercase tracking-wider ${STEP_COLOR[s.kind] ?? "text-white/60"}`}>
                      {STEP_LABEL[s.kind] ?? s.kind}
                    </span>
                    {s.input ? <span className="ml-2 text-white/40">{s.input.slice(0, 70)}</span> : null}
                  </summary>
                  {s.output ? (
                    <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap px-3 pb-3 text-[11px] text-white/50">
                      {s.output}
                    </pre>
                  ) : null}
                </details>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
