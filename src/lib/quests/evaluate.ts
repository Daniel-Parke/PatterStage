// ═══════════════════════════════════════════════════════════════
// evaluate.ts — the quest programme, derived once per stats read
//
// Every quest number PatterStage shows is DERIVED from the ledger on read, and
// ADR-0009 prunes that ledger on a schedule. Left alone, a quest an operator
// finished in March would quietly un-finish itself in June, which is the one
// thing a progress list may never do. So completion is a high-water mark: the
// metrics can only ever ADD to it, and a small map in operator_prefs (the
// latch) remembers what they once said.
//
// Nothing here reads a database, a clock or the environment. `nowIso` is a
// parameter and the latch is an argument, so the same inputs always give the
// same answer and the whole thing can be tested without a fixture install.
// ═══════════════════════════════════════════════════════════════

import {
  QUEST_CHAPTERS,
  QUEST_DEFS,
  proofMet,
  type ConceptId,
  type QuestProof,
  type QuestRequirement,
} from "@/lib/quests/quest-defs";
import type { RawMetrics } from "@/lib/stats/derive";

/** What the store remembers between reads. */
export interface QuestLatch {
  /** Quest id → ISO time it was FIRST seen complete. */
  completedAt: Record<string, string>;
  skipped: string[];
  /** False when `quests.completedAt` has never been written for this install. */
  seeded: boolean;
}

export interface QuestState {
  id: string;
  chapter: number;
  title: string;
  action: string;
  screen: string;
  teaches: ConceptId[];
  requires?: QuestRequirement;
  earns?: string;
  proof: QuestProof;
  /** The metrics say so RIGHT NOW. */
  met: boolean;
  /** met, or the latch already holds it. This is what the UI reads. */
  completed: boolean;
  completedAt: string | null;
  skipped: boolean;
}

export interface QuestChapterState {
  number: number;
  id: string;
  title: string;
  blurb: string;
  seeAlso?: { label: string; href: string }[];
  total: number;
  completed: number;
}

export interface QuestProgress {
  chapters: QuestChapterState[];
  quests: QuestState[];
  /** Completed among the counted set. */
  completed: number;
  /** Every quest that is not skipped. An unavailable host does NOT change this. */
  total: number;
  /** The merged latch the caller should persist. */
  nextCompletedAt: Record<string, string>;
  /** True when the caller has something to write. */
  latchChanged: boolean;
  /** True on the very first evaluation of an install. */
  seeding: boolean;
}

/**
 * Turn the ledger into a per-quest answer.
 *
 * The latch wins over the metrics in one direction only: it can say a quest is
 * done that the metrics no longer prove, and it can never say a quest is not
 * done that they do. `nextCompletedAt` is the map the caller should persist —
 * it only ever grows, and an id it does not recognise is carried through
 * untouched, so renaming or retiring a quest never deletes an operator's
 * history behind their back.
 */
export function evaluateQuests(m: RawMetrics, latch: QuestLatch, nowIso: string): QuestProgress {
  const skipped = new Set(latch.skipped);
  const nextCompletedAt: Record<string, string> = { ...latch.completedAt };
  let stamped = false;

  const quests: QuestState[] = QUEST_DEFS.map((def) => {
    const met = proofMet(def.proof, m);
    const already = latch.completedAt[def.id];
    if (met && already === undefined) {
      nextCompletedAt[def.id] = nowIso;
      stamped = true;
    }
    return {
      id: def.id,
      chapter: def.chapter,
      title: def.title,
      action: def.action,
      screen: def.screen,
      teaches: def.teaches,
      requires: def.requires,
      earns: def.earns,
      proof: def.proof,
      met,
      // The high-water mark. Retention taking the events away is not the
      // operator un-doing the work.
      completed: met || already !== undefined,
      // The stored stamp is when it was FIRST seen and is never rewritten;
      // a quest met for the first time on this read is stamped now.
      completedAt: already ?? (met ? nowIso : null),
      skipped: skipped.has(def.id),
    };
  });

  // A skipped quest leaves the denominator but stays in the list: it is still
  // something the operator could come back to. A quest this host cannot run
  // stays in BOTH, because the arithmetic describes the install's history and
  // not whether a gateway happens to answer this minute.
  const counted = quests.filter((q) => !q.skipped);

  const chapters: QuestChapterState[] = QUEST_CHAPTERS.map((c) => {
    const mine = counted.filter((q) => q.chapter === c.number);
    return {
      number: c.number,
      id: c.id,
      title: c.title,
      blurb: c.blurb,
      seeAlso: c.seeAlso,
      total: mine.length,
      completed: mine.filter((q) => q.completed).length,
    };
  });

  const seeding = !latch.seeded;

  return {
    chapters,
    quests,
    completed: counted.filter((q) => q.completed).length,
    total: counted.length,
    nextCompletedAt,
    // A seeding read writes even when nothing moved, because the ROW is the
    // seed flag: without it a fresh install that finishes nothing on its first
    // poll would still look fresh on its second, and the whole backlog would
    // toast at once the day something finally ticked.
    latchChanged: stamped || seeding,
    seeding,
  };
}
