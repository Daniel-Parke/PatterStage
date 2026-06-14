"use client";

import { useMemo } from "react";
import { AlertOctagon, AlertTriangle, Info, FileText } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";

function severityOf(line: string): "error" | "warn" | "info" {
  if (/\b(error|err|fatal|exception|traceback|fail(?:ed|ure)?)\b/i.test(line)) return "error";
  if (/\bwarn(?:ing)?\b/i.test(line)) return "warn";
  return "info";
}

/**
 * Severity overview for the current log view — error/warn/info mix donut, count
 * tiles, and a "clean rate" ring (share of non-error lines). Heuristic parse of
 * the raw lines; hidden when the log is empty.
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
        { icon: AlertOctagon, label: "Errors", value: s.error, color: "pink" },
        { icon: AlertTriangle, label: "Warnings", value: s.warn, color: "orange" },
        { icon: Info, label: "Info", value: s.info, color: "cyan", compact: true },
        { icon: FileText, label: "Lines", value: s.total, color: "green", compact: true },
      ]}
      ring={{
        value: clean,
        color: s.error > 0 ? "orange" : "green",
        label: <span className="text-xs">{Math.round(clean * 100)}%</span>,
        sublabel: "clean",
      }}
    />
  );
}
