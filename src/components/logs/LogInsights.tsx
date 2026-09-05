"use client";

import { useMemo } from "react";
import { AlertOctagon, AlertTriangle, Info, FileText } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";
import { severityOf } from "@/components/logs/log-line-severity";

/** What each tile counts, in the operator's words. See log-line-severity.ts. */
const HINTS = {
  error:
    "Lines the log itself tagged error, fatal or critical, plus lines naming a failure, exception or traceback. " +
    "A line that says there were none (\"no errors\", \"errors: 0\") is not counted.",
  warn: "Lines tagged warn or warning, plus lines naming a deprecation. Negated mentions are not counted.",
  info: "Everything else in the current view. Not a claim that the line is good news, only that nothing marks it as bad.",
  lines: "Lines in the view as filtered, which is what every share on this strip is a share of.",
} as const;

/**
 * Severity overview for the current log view — error/warn/info mix donut, count
 * tiles, and a "clean rate" ring (share of non-error lines). Heuristic parse of
 * the raw lines; hidden when the log is empty.
 *
 * The counts are a heuristic over unstructured text, so each tile carries a
 * hint saying exactly what it counted. Before T-0034 the rule counted any line
 * containing the word "error", which meant `Found 0 errors` raised the error
 * count and lowered the clean rate; both numbers moved when that was fixed.
 */
export default function LogInsights({ lines }: { lines: string[] }) {
  const s = useMemo(() => {
    let error = 0;
    let warn = 0;
    let info = 0;
    for (const l of lines) {
      const sev = severityOf(l);
      if (sev === "error") error++;
      else if (sev === "warn") warn++;
      else info++;
    }
    return { total: lines.length, error, warn, info };
  }, [lines]);

  if (lines.length === 0) return null;
  const clean = s.total > 0 ? 1 - s.error / s.total : 1;

  return (
    <StatStrip
      className="mb-4"
      donut={{
        segments: [
          { label: "Errors", value: s.error, color: "pink" },
          { label: "Warnings", value: s.warn, color: "orange" },
          { label: "Info", value: s.info, color: "cyan" },
        ],
        center: s.total,
        centerSub: "lines",
      }}
      tiles={[
        { icon: AlertOctagon, label: "Errors", value: s.error, color: "pink", hint: HINTS.error },
        { icon: AlertTriangle, label: "Warnings", value: s.warn, color: "orange", hint: HINTS.warn },
        { icon: Info, label: "Info", value: s.info, color: "cyan", compact: true, hint: HINTS.info },
        { icon: FileText, label: "Lines", value: s.total, color: "green", compact: true, hint: HINTS.lines },
      ]}
      ring={{
        value: clean,
        color: s.error > 0 ? "orange" : "green",
        label: <span className="text-xs">{Math.round(clean * 100)}%</span>,
        sublabel: "clean",
        hint: "Share of lines in this view that are not counted as errors. A view with no errors reads 100%.",
      }}
    />
  );
}
