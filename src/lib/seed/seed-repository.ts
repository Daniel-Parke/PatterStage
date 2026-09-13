// ═══════════════════════════════════════════════════════════════
// seed/seed-repository.ts — the database side of the catalog seed
//
// catalog-seed.ts decides WHAT to seed (manifests, template packs,
// module hand-offs) and delegates every table it touches to a
// repository. Most of those repositories already existed
// (catalog-template-repository, skills-repository, tool-catalog-
// repository, memory-catalog-repository); these are the statements
// that had nowhere to go: the mission-category seed file and the
// one-time `catalog_seeded` flag.
//
// Nothing here swallows an error. runCatalogSeed and
// ensureCatalogSeededOnce own their own failure policy (the latter
// is explicitly best-effort and must never throw into boot), and a
// second swallow in here would hide a failure from the policy that
// is supposed to decide about it.
// ═══════════════════════════════════════════════════════════════

import { getDb } from "../db";

/** Drop every seeded mission category, leaving operator-authored ones alone. */
export function deleteSeededMissionCategories(): void {
  getDb().exec("DELETE FROM mission_categories WHERE seed_key IS NOT NULL");
}

/**
 * Run a numbered seed script from src/lib/db/seeds/ verbatim.
 *
 * The seed files are multi-statement INSERTs, which is why this takes SQL
 * text rather than exposing a row-shaped API: the script IS the data. It is
 * only ever handed a file this repo ships, never anything caller-supplied.
 */
export function execSeedScript(sql: string): void {
  getDb().exec(sql);
}

/** How many seeded mission categories are present after a seed run. */
export function countSeededMissionCategories(): number | undefined {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS c FROM mission_categories WHERE seed_key IS NOT NULL")
      .get() as { c: number } | undefined
  )?.c;
}

/** The one-time boot-seed flag, or undefined when the catalog has never been seeded. */
export function readCatalogSeededFlag(): { value: string } | undefined {
  return getDb().prepare("SELECT value FROM meta WHERE key = 'catalog_seeded'").get() as
    | { value: string }
    | undefined;
}

/** Record that the one-time boot seed has run, at the given ISO timestamp. */
export function markCatalogSeeded(at: string): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('catalog_seeded', ?)")
    .run(at);
}
