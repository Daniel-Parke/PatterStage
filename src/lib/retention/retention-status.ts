// ═══════════════════════════════════════════════════════════════
// retention/retention-status.ts · what the readings tables currently look like
//
// Two jobs. The first is to let an operator see the policy and the volume before
// deciding to enable anything, because nobody should arm a delete without first
// being shown what it is aimed at.
//
// The second is to keep WG-ARCH-008's physical split HONEST. The ruling defers
// the split until volume forces it, and a deferred decision with no trigger
// anybody can observe is a decision that never gets revisited. `splitDue` is
// that trigger, evaluated against live row counts and printed by the prune
// command, so the condition announces itself instead of waiting to be
// remembered.
//
// `splitDue` requires the policy to be ENABLED as well as the count to be over
// the threshold. Retention is the cheap answer and has to be tried first; a
// table over the line with the prune switched off has not proved that volume
// forced anything, it has proved nobody turned retention on.
// ═══════════════════════════════════════════════════════════════

import {
  RETENTION_LAW,
  RETENTION_TABLES,
  type RetentionDeclaration,
  type RetentionTable,
} from "./retention-law";
import {
  countRetentionTableRows,
  readOldestRetentionRow,
  readRetentionPolicy,
} from "./retention-repository";

export interface RetentionTableStatus {
  table: RetentionTable;
  law: RetentionDeclaration;
  /** False when the policy row is missing as well as when it is switched off. */
  enabled: boolean;
  /** The stored window, or the shipped default when there is no policy row. */
  retainDays: number;
  /** True when migration 032 has not run on this database. */
  policyMissing: boolean;
  rows: number;
  oldestRow: string | null;
  /** Volume has forced WG-ARCH-008's physical split. */
  splitDue: boolean;
}

export function readRetentionStatus(): RetentionTableStatus[] {
  return RETENTION_TABLES.map((table) => {
    const law = RETENTION_LAW[table];
    const policy = readRetentionPolicy(table);
    const rows = countRetentionTableRows(table);
    const enabled = policy?.enabled === true;
    return {
      table,
      law,
      enabled,
      retainDays: policy?.retainDays ?? law.defaultDays,
      policyMissing: policy === null,
      rows,
      oldestRow: readOldestRetentionRow(table),
      splitDue: enabled && rows > law.splitThresholdRows,
    };
  });
}
