"use client";

import { useMemo } from "react";
import StatStrip from "@/components/viz/StatStrip";
import { severityOf } from "@/components/logs/log-line-severity";

/**
 * What the strip counts, in the operator's words. See log-line-severity.ts.
 *
 * These used to hang off three tiles that restated the donut's own arcs. The
 * tiles went in T-0124; the EXPLANATION did not, because it is the only place
 * the reader is told that this is a heuristic over unstructured text and what
 * it does and does not count. It hangs off the ring now, which is the number
 * the definition of "error" actually determines.
 */
const HINT =
  "Share of lines in this view that are not counted as errors, so a view with no errors reads 100%. " +
  "An error is a line the log itself tagged error, fatal or critical, or one naming a failure, exception " +
  "or traceback; a line that says there were NONE (\"no errors\", \"errors: 0\") is not one. Warnings are " +
  "lines tagged warn or warning, or naming a deprecation. Everything else is info, which is not a claim " +
  "that the line is good news - only that nothing marks it as bad.";

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
      // No tiles. Errors, Warnings and Info are the donut's own three arcs,
      // the line count is the number in its centre, and how clean the file is
      // is the ring beside it. There is nothing left that a tile could say
      // which one of the three pictures does not, and inventing one would be
      // the defect this rule exists to stop (T-0124).
      tiles={[]}
      ring={{
        value: clean,
        color: s.error > 0 ? "orange" : "green",
        label: <span className="text-body">{Math.round(clean * 100)}%</span>,
        sublabel: "clean",
        hint: HINT,
      }}
    />
  );
}
