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
