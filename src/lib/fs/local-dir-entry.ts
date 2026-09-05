// ═══════════════════════════════════════════════════════════════
// local-dir-entry — Normalise mission / template working directories
// ═══════════════════════════════════════════════════════════════

import os from "os";
import { isAbsolute, resolve } from "path";

import type { LocalDirEntry } from "@/types/console";

/**
 * Expand a leading "~" in a path to the user's home directory.
 * Returns the input unchanged if it doesn't start with "~".
 */
function expandTilde(p: string): string {
  if (p.startsWith("~/")) {
    return resolve(os.homedir(), p.slice(2));
  }
  return p;
}

/**
 * Coerce JSON / API payloads to `LocalDirEntry[]`.
 * Accepts legacy `string[]` or `{ path, branch? }[]`.
 */
export function normalizeLocalDirsInput(raw: unknown): LocalDirEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LocalDirEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const rawPath = item.trim();
      if (!rawPath) continue;
      const path = expandTilde(rawPath);
      if (!isAbsolute(path)) continue; // skip non-absolute paths after expansion
      out.push({ path, branch: null });
      continue;
    }
    if (item && typeof item === "object" && "path" in item) {
      const rec = item as { path: unknown; branch?: unknown };
      if (typeof rec.path !== "string") continue;
      const rawPath = rec.path.trim();
      if (!rawPath) continue;
      const path = expandTilde(rawPath);
      if (!isAbsolute(path)) continue; // skip non-absolute paths after expansion
      let branch: string | null = null;
      if (rec.branch !== undefined && rec.branch !== null && rec.branch !== "") {
        branch = String(rec.branch).trim() || null;
      }
      out.push({ path, branch });
    }
  }
  return out;
}

/** One bullet line (+ optional branch hint) for Working Directories section. */
export function formatLocalDirEntryLine(e: LocalDirEntry): string {
  const b = e.branch && String(e.branch).trim();
  if (b) {
    return `  - ${e.path}\n    Use git branch: ${b}`;
  }
  return `  - ${e.path}`;
}

/**
 * Commit the current `draft` into the existing `entries` list.
 *
 * Returns `null` when the commit was a no-op (empty / whitespace-only path,
 * or duplicate of an existing entry). On success, returns the next
 * `LocalDirEntry[]` to assign back to state and the empty-draft object
 * the caller should use to reset the draft.
 *
 * The 4-line "trim → dedupe-by-path → push → reset" sequence was
 * duplicated inline in `MissionCreateForm.tsx` (the "Add" button for
 * working directories) and `TemplateModals.tsx` (the "Add" button for
 * the template editor's local directories). Centralising it here keeps
 * the 2 callsites in lockstep if a future "expand tilde" or "auto-set
 * branch from cwd" extension lands.
 *
 * Pure function — no React or state mutation. The caller is responsible
 * for assigning the return value to its `setEntries` / `setDraft` setters.
 */
export function commitLocalDirDraft(
  draft: LocalDirEntry,
  entries: LocalDirEntry[],
): { nextEntries: LocalDirEntry[]; emptyDraft: LocalDirEntry } | null {
  const path = draft.path.trim();
  if (!path) return null;
  if (entries.some((d) => d.path === path)) return null;
  return {
    nextEntries: [
      ...entries,
      { path, branch: draft.branch || null },
    ],
    emptyDraft: { path: "", branch: null },
  };
}
