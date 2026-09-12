// ═══════════════════════════════════════════════════════════════
// memory-catalog-repository.ts — canonical default MEMORY facts (fair-test pillar)
//
// A central, CH-DB-owned set of canonical facts (independent of any user/agent).
// When a benchmark enables "memory", these facts are loaded into the configured
// memory provider for the run, so a memory-recall suite has a known ground truth
// to retrieve. See [[phase-b-benchmarking]].
// ═══════════════════════════════════════════════════════════════

import { getDb, now, uuid } from "../db";

type MemorySource = "bundled" | "custom";

export interface UpsertMemoryFactInput {
  content: string;
  category?: string;
  source?: MemorySource;
  /** Stable key for idempotent seeding (re-seeding the same key is a no-op). */
  seedKey?: string | null;
}

export function upsertMemoryFact(input: UpsertMemoryFactInput): void {
  // Idempotent by seed_key when provided (the unique index enforces it).
  if (input.seedKey) {
    const existing = getDb()
      .prepare("SELECT id FROM seed_memory_facts WHERE seed_key = ?")
      .get(input.seedKey) as { id: string } | undefined;
    if (existing) {
      getDb()
        .prepare("UPDATE seed_memory_facts SET content = ?, category = ? WHERE seed_key = ?")
        .run(input.content, input.category ?? "", input.seedKey);
      return;
    }
  }
  getDb()
    .prepare(
      `INSERT INTO seed_memory_facts (id, content, category, source, seed_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(uuid(), input.content, input.category ?? "", input.source ?? "custom", input.seedKey ?? null, now());
}
