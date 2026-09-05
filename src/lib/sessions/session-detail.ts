// ══════════════════════════════════════════════════════════════════════════════
// session-detail — pure helpers for GET /api/sessions/[id]
// ══════════════════════════════════════════════════════════════════════════════
//
// The session-detail route has 4 distinct return branches (Hermes state.db,
// legacy file JSONL, legacy file JSON, mission-output file, no-output-yet
// sentinel) that all build the same `data` payload shape. This module
// consolidates:
//   - the standardized `SessionData` payload type
//   - `buildSessionData(input)` — defaulting helper for `messageCount`
//   - `findFileWithExtension(dir, baseName, extensions)` — the "try the raw
//     name, then .json, then .jsonl" file-discovery pattern
//
// Keeping the helpers exported and pure makes them unit-testable in
// isolation, and means a future route that needs the same response shape
// or the same file-discovery pattern can import them rather than
// re-implementing (which is what caused the 3x `existsSync` repetition
// the original route had).
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

/**
 * Resolve the standardized GET /api/sessions/[id] response payload from
 * the per-branch raw fields. `messageCount` is derived from
 * `messages.length` when omitted. Any extra keys (e.g. `note`) pass
 * through unchanged.
 */
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
//
// `GET /api/sessions/[id]` has 2 branches that build a `SessionData`
// payload from a `SessionRecord` row: the mission-output-file branch
// (transcript exists) and the no-output-yet branch (mission-spawned
// session whose agent hasn't produced a file). Both share the same
// 4 envelope fields (title/model/source/created) derived from the
// DB row. Extracting the shared fields keeps the two call sites in
// sync and lets a future 3rd branch (e.g. streaming-output) reuse the
// same derivation without re-implementing the fallbacks.

/**
 * Minimal shape the helper reads from the `SessionRecord`. Defined as
 * a local structural alias (not imported) so this module stays
 * decoupled from the repository's full row type — the helper only
 * needs these 4 fields.
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
 * Build the 4 shared `SessionData` envelope fields from a DB session
 * row. `title` falls back to the sanitized id; `model` falls back to
 * `""` (matches the legacy file branches' `data.model || ""` shape).
 * `created` is forwarded verbatim — `null` is allowed and surfaces as
 * `"created": null` in the wire payload.
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
// The mission-output branch of `GET /api/sessions/[id]` reads a
// `.session` or `.output.log` file written by the recurring-mission
// dispatch pipeline. The format is one assistant message per line
// (no JSON envelope, no role field). Extracting the split/filter/map
// skeleton gives us a unit-testable parser that future consumers
// (e.g. an export-to-JSONL tool) can import rather than re-implement.

/**
 * Parse a mission-output file body into a `SessionMessage[]` array.
 * Each non-blank line becomes a single assistant message with that
 * line as its `content`. Empty / whitespace-only lines are dropped.
 * `index` is the line's position in the *filtered* array (matches
 * the pre-refactor behaviour where the `.map((line, i) => ...)`
 * callback's `i` was the index of the filtered line, not the raw
 * line in the file).
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
