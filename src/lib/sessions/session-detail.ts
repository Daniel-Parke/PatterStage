// ══════════════════════════════════════════════════════════════════════════════
// session-detail — pure helpers for GET /api/sessions/[id]
// ══════════════════════════════════════════════════════════════════════════════
//
// Every branch of the session-detail route (Hermes state.db, legacy file
// JSONL, legacy file JSON, mission-output file, no-output-yet sentinel)
// builds the same `data` payload. The shape and the helpers the branches
// share live here, pure, so they are unit-tested without the route.
// ══════════════════════════════════════════════════════════════════════════════

import { existsSync } from "fs";
import { join } from "path";

import type { SessionStatus } from "@/lib/sessions/session-repository";

/**
 * Standard shape returned by every branch of GET /api/sessions/[id].
 * Each field beyond `id`/`format`/`filename`/`messages`/`size` is
 * optional so callers fill in only what they have. Extra fields
 * (e.g. `note` for the no-output-yet branch) flow through unchanged.
 */
export interface SessionData {
  id: string;
  filename: string;
  format: string;
  title?: string;
  model?: string;
  source?: string;
  messages: unknown[];
  messageCount?: number;
  size: number;
  created?: string | null;
  missionId?: string | null;
  note?: string;
  /**
   * How the session ended, with the reason. All three were stored, sent
   * nowhere and rendered nowhere, so a failed session looked exactly like a
   * successful one (T-0105, D30).
   */
  status?: SessionStatus;
  exitCode?: number | null;
  error?: string | null;
  /** True when older messages were left behind by the message cap (D40). */
  truncated?: boolean;
  [key: string]: unknown;
}

/** The GET /api/sessions/[id] payload; `messageCount` defaults to `messages.length`. */
export function buildSessionData(input: SessionData): SessionData {
  return {
    ...input,
    messageCount: input.messageCount ?? input.messages.length,
  };
}

/**
 * Find the first existing file in `dir` whose name is `baseName` with
 * one of the given `extensions` appended. Returns the absolute path or
 * null if no variant exists. Suffixes are tried in order, so callers
 * can prefer e.g. the raw name over `.json` over `.jsonl`.
 *
 * Pass `""` (empty string) in the array to try the baseName without any
 * suffix — the legacy sessions store has both suffixed and unsuffixed
 * files.
 */
export function findFileWithExtension(
  dir: string,
  baseName: string,
  extensions: readonly string[],
): string | null {
  for (const ext of extensions) {
    const candidate = join(dir, `${baseName}${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// ── DB-derived envelope helper ─────────────────────────────────

/**
 * The `SessionRecord` fields the envelope reads. A local structural type
 * rather than the repository's row type, so this module stays decoupled from it.
 */
export interface DbSessionEnvelope {
  title: string | null;
  modelId: string | null;
  source: string;
  startedAt: string | null;
  /** How it ended, and why. Present on every PatterStage row (T-0105, D30). */
  status?: SessionStatus;
  exitCode?: number | null;
  error?: string | null;
}

/**
 * The `SessionData` envelope fields from a DB session row. `title` falls back
 * to the sanitized id and `model` to `""`, matching the legacy file branches;
 * `created` is forwarded verbatim, so `null` reaches the wire as `null`.
 */
export function dbSessionFields(
  dbSession: DbSessionEnvelope,
  sanitizedId: string,
): {
  title: string;
  model: string;
  source: string;
  created: string | null;
  status?: SessionStatus;
  exitCode?: number | null;
  error?: string | null;
} {
  return {
    title: dbSession.title || sanitizedId,
    model: dbSession.modelId || "",
    source: dbSession.source,
    created: dbSession.startedAt,
    // How it ended travels with it now (T-0105, D30).
    status: dbSession.status,
    exitCode: dbSession.exitCode ?? null,
    error: dbSession.error ?? null,
  };
}

// ── Mission-output line parser ─────────────────────────────────
//
// A `.session` or `.output.log` file written by the recurring-mission
// dispatch pipeline is one assistant message per line: no JSON envelope, no
// role field.

/**
 * Parse a mission-output file body: each non-blank line becomes one assistant
 * message. `index` is the line's position in the filtered array, not the raw
 * line number in the file.
 */
export function parseAssistantLines(content: string): Array<{
  index: number;
  role: string;
  content: string;
}> {
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => ({
      index,
      role: "assistant",
      content: line,
    }));
}
