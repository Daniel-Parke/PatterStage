// ═══════════════════════════════════════════════════════════════
// seed/clean-dev-data.ts — purge obvious throwaway test artifacts
//
// Accumulated dev/test data (a "Testy" workflow, "Test Story 2026"
// duplicates, "Test ..." missions) clutters the live DB but isn't part of the
// seed catalog. This finds + removes the clearly-disposable ones behind a
// preview + explicit confirm. Conservative on purpose: matches only names that
// START with a test marker, so real content that merely mentions "test"
// (e.g. "Testing strategy for X") is never swept. Profiles are intentionally
// NOT touched — a "Test description" lives on a real agent the user runs.
// ═══════════════════════════════════════════════════════════════

import { listWorkflows, deleteWorkflow } from "@/lib/composer/composer-repository";
import { SERVER_MODULES } from "@/lib/modules/server";
import { listMissions, deleteMission } from "@/lib/missions/mission-repository";

const TEST_NAME = /^(testy?\b|test[\s_-]|untitled story\b)/i;

interface DevDataItem {
  id: string;
  label: string;
}

export interface DevDataCleanupReport {
  workflows: DevDataItem[];
  stories: DevDataItem[];
  missions: DevDataItem[];
}

function isTestName(name: string | null | undefined): boolean {
  return Boolean(name && TEST_NAME.test(name.trim()));
}

/** List the test artifacts a cleanup would remove (dry run — no deletes). */
export function previewDevDataCleanup(): DevDataCleanupReport {
  return {
    workflows: listWorkflows()
      .filter((w) => isTestName(w.name))
      .map((w) => ({ id: w.id, label: w.name })),
    // Module-owned records come through the composition root, so core never
    // imports a module (ADR-0005). The "looks like a test artifact" policy
    // stays here; the module only says what it owns.
    stories: SERVER_MODULES.flatMap((m) => m.listDevData?.() ?? []).filter((r) =>
      isTestName(r.label),
    ),
    missions: listMissions()
      .filter((m) => isTestName(m.name))
      .map((m) => ({ id: m.id, label: m.name })),
  };
}

export interface DevDataCleanupResult {
  removed: DevDataCleanupReport;
  counts: { workflows: number; stories: number; missions: number; total: number };
}

/** Delete the test artifacts identified by previewDevDataCleanup. */
export function cleanDevData(): DevDataCleanupResult {
  const removed = previewDevDataCleanup();
  for (const w of removed.workflows) deleteWorkflow(w.id);
  for (const s of removed.stories) {
    for (const m of SERVER_MODULES) m.deleteDevData?.(s.id);
  }
  for (const m of removed.missions) deleteMission(m.id);
  const counts = {
    workflows: removed.workflows.length,
    stories: removed.stories.length,
    missions: removed.missions.length,
    total: removed.workflows.length + removed.stories.length + removed.missions.length,
  };
  return { removed, counts };
}
