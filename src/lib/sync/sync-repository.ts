// ═══════════════════════════════════════════════════════════════
// sync/sync-repository.ts — the tables the sync layer owns
//
// Four tables are written by the background sync sources and by
// nothing else: gateway_platforms (EnvSync), error_log_entries
// (LogSync), agent_processes (ProcessSync) and sync_registry
// (every source's own status row). Each source used to prepare its
// own statements inline, which made the column list of each table a
// public interface spread across five files.
//
// The `meta` table is deliberately NOT here. It has one repository,
// system-repository.ts, and a second writer would defeat the point.
//
// Every function throws on failure, with ONE exception carried over
// intact: readGatewayPlatforms answers [] on a missing table, because
// the dashboard that calls it has always treated "no gateway table" as
// "no platforms configured". The sources are otherwise already wrapped
// in a try/catch that turns a failure into `{ success: false }` with
// the error attached to the SyncResult, which is the report the sync
// scheduler is built to surface; swallowing here would report success
// for a tick that wrote nothing.
// ═══════════════════════════════════════════════════════════════

import { getDb } from "@/lib/db";

// ── gateway_platforms (EnvSync) ──────────────────────────────

/** One gateway platform's enabled/token state, as EnvSync derives it from .env. */
export interface GatewayPlatformState {
  platform: string;
  enabled: number;
  bot_token_present: number;
}

/** A stored gateway platform row. */
export interface GatewayPlatformRow {
  platform: string;
  enabled: number;
  bot_token_present: number;
  last_synced_at: string;
}

/**
 * Read all gateway platform records from the DB.
 * Returns empty array if table doesn't exist or query fails.
 */
export function readGatewayPlatforms(): GatewayPlatformRow[] {
  try {
    return getDb()
      .prepare("SELECT platform, enabled, bot_token_present, last_synced_at FROM gateway_platforms")
      .all() as GatewayPlatformRow[];
  } catch {
    return [];
  }
}

/** Replace the gateway platform rows, stamping each with the same sync time. */
export function upsertGatewayPlatforms(
  platforms: readonly GatewayPlatformState[],
  lastSyncedAt: string,
): void {
  const database = getDb();
  const upsert = database.prepare(
    `INSERT OR REPLACE INTO gateway_platforms (platform, enabled, bot_token_present, last_synced_at)
         VALUES (?, ?, ?, ?)`,
  );
  const tx = database.transaction(() => {
    for (const p of platforms) {
      upsert.run(p.platform, p.enabled, p.bot_token_present, lastSyncedAt);
    }
  });
  tx();
}

// ── error_log_entries (LogSync) ──────────────────────────────

/** One parsed error line from a gateway or agent log. */
export interface ErrorLogEntryInput {
  source: string;
  message: string;
  timestamp: string;
  severity: string;
}

/** Append a batch of error log entries in one transaction. */
export function insertErrorLogEntries(
  entries: readonly ErrorLogEntryInput[],
  ingestedAt: string,
): void {
  const database = getDb();
  const insert = database.prepare(
    `INSERT INTO error_log_entries (source, message, timestamp, severity, ingested_at)
         VALUES (?, ?, ?, ?, ?)`,
  );
  const tx = database.transaction(() => {
    for (const entry of entries) {
      insert.run(entry.source, entry.message, entry.timestamp, entry.severity, ingestedAt);
    }
  });
  tx();
}

/** One stored error log entry, as the dashboard's Errors panel reads it. */
export interface ErrorLogEntryRow {
  source: string;
  message: string;
  timestamp: string;
  severity: string;
}

/** The ten most recent error log entries, newest first. */
export function readRecentErrorLogEntries(): ErrorLogEntryRow[] {
  return getDb()
    .prepare(
      "SELECT source, message, timestamp, severity FROM error_log_entries ORDER BY timestamp DESC LIMIT 10",
    )
    .all() as ErrorLogEntryRow[];
}

/** Keep only the 500 most recent error log entries. */
export function pruneErrorLogEntries(): void {
  getDb()
    .prepare(
      `DELETE FROM error_log_entries WHERE id NOT IN (
            SELECT id FROM error_log_entries ORDER BY timestamp DESC LIMIT 500
          )`,
    )
    .run();
}

// ── agent_processes (ProcessSync) ────────────────────────────

/** One running agent process, as ProcessSync parses it out of `ps aux`. */
export interface AgentProcessInput {
  id: string;
  type: string;
  name: string;
  status: string;
  pid: number | null;
  model: string;
  turns: number;
  lastActivity: string;
}

/** One stored process row, as /api/agents reads it back out. */
export interface AgentProcessRow {
  id: string;
  type: string;
  name: string;
  status: string;
  pid: number | null;
  model: string;
  turns: number;
  last_activity: string | null;
  last_seen_at: string;
}

/** Every known agent process, ordered by type then name. */
export function readAgentProcesses(): AgentProcessRow[] {
  return getDb()
    .prepare(
      "SELECT id, type, name, status, pid, model, turns, last_activity, last_seen_at FROM agent_processes ORDER BY type, name",
    )
    .all() as AgentProcessRow[];
}

/** Clear the process table before a fresh scan writes into it. */
export function deleteAllAgentProcesses(): void {
  getDb().prepare("DELETE FROM agent_processes").run();
}

/** Write a freshly-scanned batch of processes in one transaction. */
export function insertAgentProcesses(
  processes: readonly AgentProcessInput[],
  lastSeenAt: string,
): void {
  const database = getDb();
  const insert = database.prepare(
    `INSERT INTO agent_processes (id, type, name, status, pid, model, turns, last_activity, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = database.transaction(() => {
    for (const p of processes) {
      insert.run(
        p.id,
        p.type,
        p.name,
        p.status,
        p.pid,
        p.model,
        p.turns,
        p.lastActivity,
        lastSeenAt,
      );
    }
  });
  tx();
}

// ── sync_registry (per-source status) ────────────────────────

/** Record a successful tick for a sync source. */
export function recordSyncSuccess(sourceName: string, syncedCount: number): void {
  getDb()
    .prepare(/* sql */ `
        INSERT OR REPLACE INTO sync_registry (source_name, last_synced_at, status, synced_count, error)
        VALUES (?, datetime('now'), 'ok', ?, NULL)
      `)
    .run(sourceName, syncedCount);
}

/** Record a failed tick for a sync source, with the error text. */
export function recordSyncFailure(sourceName: string, error: string): void {
  getDb()
    .prepare(/* sql */ `
          INSERT OR REPLACE INTO sync_registry (source_name, last_synced_at, status, synced_count, error)
          VALUES (?, datetime('now'), 'error', 0, ?)
        `)
    .run(sourceName, error);
}
