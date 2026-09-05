// ═══════════════════════════════════════════════════════════════
// quest-latch.ts — where the high-water mark is kept
//
// Two of the six allow-listed operator preferences, read and written through
// the repository that already validates them: `quests.completedAt` (quest id →
// the ISO time it was first seen complete) and `quests.skipped`. No new key, no
// new migration; B3's 038 already ships both.
//
// Every read here is defensive. A database with no operator_prefs table, or a
// row this process cannot parse, yields an empty unseeded latch rather than an
// exception: the dashboard is the surface that reads it, and the dashboard must
// not go dark because bookkeeping is missing.
// ═══════════════════════════════════════════════════════════════

import { readOperatorPrefs, writeOperatorPref } from "@/lib/operator-prefs-repository";
import type { QuestLatch } from "@/lib/quests/evaluate";

const COMPLETED_AT_KEY = "quests.completedAt";
const SKIPPED_KEY = "quests.skipped";

const EMPTY: QuestLatch = { completedAt: {}, skipped: [], seeded: false };

/** Only the id → ISO-string pairs. A value of any other shape is dropped. */
function asStamps(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [id, at] of Object.entries(value as Record<string, unknown>)) {
    if (typeof at === "string") out[id] = at;
  }
  return out;
}

function asIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

/**
 * What the store remembers.
 *
 * `seeded` is the presence of the ROW, not a non-empty map. An install whose
 * first evaluation finds nothing complete must still count as seeded once the
 * row is written, or every quest it later finishes would look like a backlog
 * arriving at once.
 */
export function readQuestLatch(): QuestLatch {
  let prefs: Record<string, unknown>;
  try {
    prefs = readOperatorPrefs();
  } catch {
    return { ...EMPTY };
  }
  return {
    completedAt: asStamps(prefs[COMPLETED_AT_KEY]),
    skipped: asIds(prefs[SKIPPED_KEY]),
    seeded: Object.prototype.hasOwnProperty.call(prefs, COMPLETED_AT_KEY),
  };
}

/** Persist the merged map. The repository validates it against its own schema. */
export function writeQuestCompletions(completedAt: Record<string, string>): void {
  writeOperatorPref(COMPLETED_AT_KEY, completedAt);
}
