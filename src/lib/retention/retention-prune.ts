// ═══════════════════════════════════════════════════════════════
// retention/retention-prune.ts · the only thing in PatterStage that deletes
// somebody else's data
//
// It runs on machines belonging to people the operator has never met, and it
// cannot be undone. Everything below is shaped by that and by ADR-0009.
//
// ── FOUR REFUSALS BEFORE ANY DELETE ────────────────────────────
//
// 1. NOT ENABLED. Migration 032 seeds both policies disabled, on every install,
//    fresh and existing. An upgrade prunes nothing. Somebody has to turn it on.
// 2. NOT APPLIED. Without `apply: true` this is a preview that reports exactly
//    what would go and deletes nothing. The command line defaults to that form.
// 3. PROGRESSION NOT CAPTURED. Nothing may delete a row that the per-Body record
//    (migration 031, WG-ARCH-003) has not already seen. The check is below and
//    it is the reason this task was ordered after that one.
// 4. CAPTURE FAILED. If the capture threw, the record is not known to be current,
//    so every table refuses. A failure to write the record is treated exactly
//    like the record not existing.
//
// ── THE ORDERING INTERLOCK, WHICH IS THE HEART OF THIS FILE ────
//
// The prune captures progression FIRST, then reads the newest capture instant,
// then deletes only rows strictly older than the cutoff. So:
//
//     every deleted row is older than the cutoff
//     the cutoff is older than the capture       <- checked, per table
//     therefore every deleted row existed when the capture ran
//     therefore its contribution is already inside a recorded answer
//
// The middle line is the one that can fail, and when it does this refuses rather
// than proceeds, which is the design constraint stated verbatim. It fails on an
// install where the capture wrote nothing: no agent profiles, so no rows, so no
// watermark, so no proof. That install does not prune. Refusing to act without
// evidence is the correct outcome even when the evidence would have been
// trivially favourable.
//
// The capture is injected rather than imported so this module does not drag the
// whole dashboard aggregate behind it, and so the tests can drive it. That is
// not a hole: a caller who injects a capture that does nothing does not get a
// prune, because the interlock reads the DATABASE for its evidence and not the
// callback's return value.
//
// ── WHAT "OBSERVABLE" MEANS HERE ───────────────────────────────
//
// Every applied invocation writes one row per table into `retention_prune_runs`,
// including the ones that deleted nothing and the ones that refused, and logs a
// line saying what happened. An operator who wonders whether it ran can read
// either. Dry runs log but do not write, because they are not events in this
// database's history.
//
// The delete and its record commit TOGETHER. That is the one place this file
// takes a transaction, and it runs no statement of its own inside it: a delete
// that succeeded while its record failed would be the exact hole the record
// exists to close, so the two share a fate rather than a sequence.
// ═══════════════════════════════════════════════════════════════

import { inTransaction } from "@/lib/db";
import { readNewestProgressionCapture } from "@/lib/stats/agent-progression-repository";
import { RETENTION_LAW, RETENTION_TABLES, type RetentionTable } from "./retention-law";
import {
  countAnalyticsEventsBefore,
  countExpiredChatConversations,
  countExpiredChatMessages,
  deleteAnalyticsEventsBefore,
  deleteExpiredChatConversations,
  insertRetentionPruneRun,
  readRetentionPolicy,
  retentionCutoff,
} from "./retention-repository";

/**
 * What happened to one table.
 *
 * `disabled` and `refused` both mean nothing was deleted; they are separate
 * because "you have not switched it on" and "I will not do this yet" need
 * different answers from the operator.
 */
// Module-private on purpose. Both are reachable structurally through the
// exported RetentionPruneReport, so a caller can still read report.tables[0]
// .outcome; nothing imports either NAME, and an export nothing imports is what
// the widened knip gate exists to catch. Export them again the moment a caller
// genuinely needs to name one.
type RetentionOutcome = "pruned" | "dry-run" | "disabled" | "refused";

interface RetentionTableReport {
  table: RetentionTable;
  outcome: RetentionOutcome;
  retainDays: number;
  /** The exact boundary evaluated. Rows strictly older than this are in scope. */
  cutoff: string;
  /** Rows the window selected. */
  rowsMatched: number;
  /** Rows actually removed. Zero unless the outcome is `pruned`. */
  rowsDeleted: number;
  /** The progression capture the interlock checked against. */
  progressionWatermark: string | null;
  /** One sentence an operator can act on. */
  detail: string;
}

export interface RetentionPruneReport {
  /** False for a preview. */
  applied: boolean;
  /** Rows the pre-prune capture appended. */
  progressionRowsCaptured: number;
  progressionWatermark: string | null;
  tables: RetentionTableReport[];
}

export interface RetentionPruneOptions {
  /** Delete for real. Omit or pass false for a preview. */
  apply?: boolean;
  /**
   * Capture progression before anything is deleted, returning the rows appended.
   * Must append unconditionally (`{ force: true }`); see the header.
   */
  captureProgression: () => number;
  /** Where the running commentary goes. Defaults to stdout. */
  log?: (line: string) => void;
}

/** Rows the window selects, without deleting anything. */
function measure(table: RetentionTable, cutoff: string): { matched: number; detail: string } {
  if (table === "analytics_events") {
    return { matched: countAnalyticsEventsBefore(cutoff), detail: "" };
  }
  const conversations = countExpiredChatConversations(cutoff);
  const messages = countExpiredChatMessages(cutoff);
  return {
    matched: messages,
    detail: `${conversations} conversation(s) with no activity since the cutoff`,
  };
}

function remove(table: RetentionTable, cutoff: string): { deleted: number; detail: string } {
  if (table === "analytics_events") {
    return { deleted: deleteAnalyticsEventsBefore(cutoff), detail: "" };
  }
  const result = deleteExpiredChatConversations(cutoff);
  return {
    deleted: result.messages,
    detail: `${result.conversations} conversation(s) deleted whole`,
  };
}

function toRecord(report: RetentionTableReport) {
  return {
    table: report.table,
    outcome: report.outcome,
    retainDays: report.retainDays,
    cutoff: report.cutoff,
    rowsMatched: report.rowsMatched,
    rowsDeleted: report.rowsDeleted,
    progressionWatermark: report.progressionWatermark,
    detail: report.detail,
  };
}

function describe(report: RetentionTableReport): string {
  const window = `window ${report.retainDays}d, cutoff ${report.cutoff}`;
  switch (report.outcome) {
    case "pruned":
      return `[retention] ${report.table}: deleted ${report.rowsDeleted} row(s) (${window}; progression captured ${report.progressionWatermark}). ${report.detail}`.trim();
    case "dry-run":
      return `[retention] ${report.table}: WOULD delete ${report.rowsMatched} row(s) (${window}). Nothing was deleted. ${report.detail}`.trim();
    case "disabled":
      return `[retention] ${report.table}: policy is OFF, kept everything. ${report.rowsMatched} row(s) are older than the ${window}.`;
    case "refused":
      return `[retention] ${report.table}: REFUSED, nothing deleted. ${report.detail}`;
  }
}

/**
 * Run the prune, or preview it.
 *
 * Never throws for an ordinary refusal: a refusal is a reported outcome, because
 * a caller that has to catch an exception to learn that nothing was deleted will
 * eventually catch it in the wrong place. It DOES propagate a genuine database
 * failure from the delete itself, which is rolled back by its own transaction.
 */
export function runRetentionPrune(options: RetentionPruneOptions): RetentionPruneReport {
  const apply = options.apply === true;
  const log = options.log ?? ((line: string) => console.log(line));

  // Step one, before a single row is measured: write the record that makes the
  // deletion survivable.
  let captured = 0;
  let captureFailure: string | null = null;
  try {
    captured = options.captureProgression();
  } catch (error) {
    captureFailure = error instanceof Error ? error.message : String(error);
  }
  const watermark = readNewestProgressionCapture();

  if (captureFailure) {
    log(`[retention] progression capture FAILED: ${captureFailure}`);
  } else {
    log(
      `[retention] progression captured: ${captured} row(s) appended, newest capture ${watermark ?? "none"}`,
    );
  }

  const tables: RetentionTableReport[] = [];

  for (const table of RETENTION_TABLES) {
    const policy = readRetentionPolicy(table);
    const retainDays = policy?.retainDays ?? RETENTION_LAW[table].defaultDays;
    const cutoff = retentionCutoff(retainDays);
    const measured = measure(table, cutoff);

    const base = {
      table,
      retainDays,
      cutoff,
      rowsMatched: measured.matched,
      rowsDeleted: 0,
      progressionWatermark: watermark,
    };

    let report: RetentionTableReport;
    // Set by the delete branch, which records inside its own transaction.
    let alreadyRecorded = false;
    if (!policy) {
      report = {
        ...base,
        outcome: "refused",
        detail: `no retention policy row for ${table}; migration 032 has not run on this database`,
      };
    } else if (!policy.enabled) {
      report = { ...base, outcome: "disabled", detail: measured.detail };
    } else if (captureFailure) {
      report = {
        ...base,
        outcome: "refused",
        detail: `the pre-prune progression capture failed (${captureFailure}), so recorded growth is not known to be current`,
      };
    } else if (watermark === null) {
      report = {
        ...base,
        outcome: "refused",
        detail:
          "no progression has ever been captured, so nothing proves these rows are already recorded; either this install has no agent profile to capture or the capture step did not run",
      };
    } else if (watermark < cutoff) {
      report = {
        ...base,
        outcome: "refused",
        detail: `the newest progression capture (${watermark}) is older than the cutoff (${cutoff}), so rows in the window may never have been recorded`,
      };
    } else if (!apply) {
      report = { ...base, outcome: "dry-run", detail: measured.detail };
    } else {
      report = inTransaction(() => {
        const removed = remove(table, cutoff);
        const pruned: RetentionTableReport = {
          ...base,
          outcome: "pruned",
          rowsDeleted: removed.deleted,
          detail: removed.detail,
        };
        insertRetentionPruneRun(toRecord(pruned));
        return pruned;
      });
      alreadyRecorded = true;
    }

    tables.push(report);
    log(describe(report));

    // A preview is not an event in this database's history; an applied run is,
    // whatever its outcome. The deleting branch above has already written its
    // own record, inside the transaction that did the deleting.
    if (apply && !alreadyRecorded) insertRetentionPruneRun(toRecord(report));
  }

  return {
    applied: apply,
    progressionRowsCaptured: captured,
    progressionWatermark: watermark,
    tables,
  };
}
