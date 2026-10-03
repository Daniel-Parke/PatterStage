// ═══════════════════════════════════════════════════════════════
// ScriptRow — one script file with its size, schedule and actions
//
// Every action is a callback; the row owns no state. Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import {
  Terminal, Play, ScrollText, CalendarClock, X, FileCode,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { timeAgo } from "@/lib/utils";
import type { ScriptFile } from "@/hooks/useScripts";

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${n}B`;
}

/**
 * A log written this long after the last recorded run is a DIFFERENT run.
 *
 * The two timestamps for one run are always a little apart: the log is appended
 * when the script exits and the ledger row is written after that, in whole
 * seconds. Anything inside this window is that gap; anything outside it is the
 * machine's own crontab, which runs the script with PatterStage nowhere in the
 * path and so moves the log while the ledger stays where it was.
 */
const SAME_RUN_MS = 120_000;

/**
 * What the row says about the last run, from the outcome the ledger recorded.
 *
 * Before this the row could only say WHEN a log was last written, which is not
 * an answer to "did last night's backup work?". Where the ledger holds nothing
 * for this script, or where something has run since the last thing it recorded,
 * the old sentence stands: a timestamp with no outcome is still worth showing,
 * and an outcome attached to the wrong run is worse than none.
 */
function lastRunNote(s: ScriptFile): { text: string; tone: string } | null {
  const recordedAt = s.lastOutcomeAt ? Date.parse(s.lastOutcomeAt) : NaN;
  const loggedAt = s.lastRun ? Date.parse(s.lastRun) : NaN;
  const outcomeIsTheLatestRun =
    !Number.isNaN(recordedAt) && (Number.isNaN(loggedAt) || loggedAt - recordedAt <= SAME_RUN_MS);
  if (s.lastOutcome && s.lastOutcomeAt && outcomeIsTheLatestRun) {
    const when = timeAgo(s.lastOutcomeAt);
    if (s.lastOutcome === "succeeded") return { text: `ran ${when}`, tone: "text-neon-green/90" };
    if (s.lastOutcome === "not-started") return { text: `did not start ${when}`, tone: "text-semantic-danger" };
    const code = s.lastExitCode === null ? "" : ` (exit code ${s.lastExitCode})`;
    return { text: `failed ${when}${code}`, tone: "text-semantic-danger" };
  }
  if (s.lastRun) return { text: `last run ${timeAgo(s.lastRun)}`, tone: "text-ps-text-muted" };
  return null;
}

export interface ScriptRowProps {
  script: ScriptFile;
  busy: boolean;
  onRun: (s: ScriptFile) => void;
  onEdit: (s: ScriptFile) => void;
  onLogs: (s: ScriptFile) => void;
  onSchedule: (s: ScriptFile) => void;
  onUnschedule: (s: ScriptFile) => void;
}

export default function ScriptRow({
  script: s,
  busy,
  onRun,
  onEdit,
  onLogs,
  onSchedule,
  onUnschedule,
}: ScriptRowProps) {
  const lastRun = lastRunNote(s);
  return (
    <Card padding="none" className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Terminal className="h-4 w-4 shrink-0 text-neon-cyan" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-body text-ps-text-primary">{s.name}</div>
        <div className="truncate font-mono text-micro text-ps-text-muted">
          {fmtSize(s.size)}
          {" · "}
          {s.schedule ? <span className="text-neon-orange/90">{s.schedule}</span> : "not scheduled"}
          {/* The honest limit of a PatterStage-owned schedule, on the row rather
              than in a help page: a crontab row fires whether the app is up or
              not, and this one does not (T-0107, decision 10). */}
          {s.scheduleSource === "patterstage" ? (
            <>
              {" · "}
              <span className="text-ps-text-faint">Runs while PatterStage is running</span>
            </>
          ) : null}
          {lastRun ? (
            <>
              {" · "}
              <span className={lastRun.tone}>{lastRun.text}</span>
            </>
          ) : null}
        </div>
      </div>
      <Button variant="primary" color="green" size="sm" icon={Play} onClick={() => onRun(s)} loading={busy}>
        Run
      </Button>
      <Button variant="secondary" size="sm" icon={FileCode} onClick={() => onEdit(s)}>
        Edit
      </Button>
      <Button variant="secondary" size="sm" icon={ScrollText} onClick={() => onLogs(s)}>
        Logs
      </Button>
      {s.schedule ? (
        <Button variant="secondary" size="sm" icon={X} onClick={() => onUnschedule(s)}>
          Unschedule
        </Button>
      ) : (
        <Button variant="primary" color="orange" size="sm" icon={CalendarClock} onClick={() => onSchedule(s)}>
          Schedule
        </Button>
      )}
    </Card>
  );
}
