#!/usr/bin/env npx tsx
/**
 * The retention prune (T-0017, source row WO-0009, ADR-0009).
 *
 * This is the ONLY entry point in PatterStage that deletes a user's rows. It is
 * a command an operator types, deliberately, on the machine that owns the data.
 * There is no HTTP route and no scheduler wiring, and that absence is the design
 * rather than an omission: nothing that destroys history should be reachable by
 * a click or by a timer that fires while nobody is watching.
 *
 * It is safe to run. The default form deletes nothing.
 *
 *   npx tsx scripts/tooling/retention-prune.ts
 *       Status and dry run. Prints the policy, the volume, the WG-ARCH-008 split
 *       threshold and exactly what a real run would delete. Changes nothing.
 *
 *   npx tsx scripts/tooling/retention-prune.ts --enable analytics_events
 *   npx tsx scripts/tooling/retention-prune.ts --enable chat_messages --days 540
 *   npx tsx scripts/tooling/retention-prune.ts --disable analytics_events
 *       Turn a policy on or off, or move its window. Both policies ship OFF on
 *       every install, fresh and existing, so an upgrade never deletes anything.
 *       Windows have floors the database enforces; a shorter one is refused.
 *
 *   npx tsx scripts/tooling/retention-prune.ts --apply
 *       Delete. Only touches a table whose policy is enabled, only rows outside
 *       the window, and only after the per-Body progression record has been
 *       captured. Writes one row per table into `retention_prune_runs`.
 *
 * Reads PS_DATA_DIR from env or .env.local, exactly like `npm run db:migrate`.
 *
 * One thing every form of this command DOES write, including the dry run: a
 * forced per-Body progression row per agent profile, before anything else
 * happens. The dry run forces too, on purpose. Forcing only on --apply would
 * leave a preview on a long-quiet install reporting a refusal for a run that
 * --apply would complete, and a false alarm on the command whose whole job is to
 * predict a deletion costs more than the rows it saves.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

function loadEnvLocal(): void {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function flagValue(argv: string[], name: string): string | null {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const next = argv[i + 1];
  return next && !next.startsWith("--") ? next : "";
}

async function main(): Promise<void> {
  loadEnvLocal();

  const { getPsDataDir, getDbPath } = await import("../../src/lib/paths");
  const dataDir = getPsDataDir();
  process.env.PS_DATA_DIR = dataDir;
  console.log(`Database: ${getDbPath(dataDir)}`);

  // Imported only after PS_DATA_DIR is set: the db module resolves the data dir
  // at import time, same constraint migrate-db.ts documents.
  const { ensureDb } = await import("../../src/lib/db");
  const { isRetentionTable, validateRetainDays } = await import(
    "../../src/lib/retention/retention-law"
  );
  const { setRetentionPolicy, readRetentionPruneRuns } = await import(
    "../../src/lib/retention/retention-repository"
  );
  const { readRetentionStatus } = await import("../../src/lib/retention/retention-status");
  const { runRetentionPrune } = await import("../../src/lib/retention/retention-prune");
  const { getDashboardStats } = await import("../../src/lib/stats/stats-repository");
  const { captureAgentProgressionSnapshots } = await import(
    "../../src/lib/stats/agent-progression"
  );

  ensureDb();

  const argv = process.argv.slice(2);

  // ── Policy changes ──────────────────────────────────────────
  for (const verb of ["--enable", "--disable"] as const) {
    const target = flagValue(argv, verb);
    if (target === null) continue;
    if (!target || !isRetentionTable(target)) {
      console.error(
        `${verb} needs one of: analytics_events, chat_messages (got ${target || "nothing"})`,
      );
      process.exit(1);
    }
    const days = flagValue(argv, "--days");
    const retainDays = days ? Number(days) : undefined;
    if (retainDays !== undefined) {
      const check = validateRetainDays(target, retainDays);
      if (!check.ok) {
        console.error(check.reason);
        process.exit(1);
      }
    }
    setRetentionPolicy(target, { enabled: verb === "--enable", retainDays });
    console.log(`${target}: retention ${verb === "--enable" ? "ENABLED" : "disabled"}`);
    if (verb === "--enable") {
      // Said at the moment of the decision, not buried in an ADR nobody opens.
      console.log(
        "  Note: once a prune has run, the Insights all-time totals and the dashboard's",
      );
      console.log(
        "  longest-streak number will read lower, because both are recomputed from the rows",
      );
      console.log(
        "  that went. Earned achievements do NOT un-earn: those are held in the per-Body",
      );
      console.log("  progression record. See ADR-0009.");
    }
  }

  // ── Status ──────────────────────────────────────────────────
  console.log("");
  for (const s of readRetentionStatus()) {
    console.log(`${s.table}`);
    console.log(`  owner        ${s.law.owner}`);
    console.log(`  consumer     ${s.law.consumer}`);
    console.log(
      `  policy       ${s.policyMissing ? "MISSING (migration 032 has not run)" : s.enabled ? "ENABLED" : "off"}, window ${s.retainDays}d (floor ${s.law.floorDays}d)`,
    );
    console.log(`  rows         ${s.rows}, oldest ${s.oldestRow ?? "none"}`);
    console.log(
      `  split        ${s.rows}/${s.law.splitThresholdRows} rows${s.splitDue ? "  <- WG-ARCH-008 split threshold reached" : ""}`,
    );
  }

  // ── Prune, or preview it ────────────────────────────────────
  const apply = argv.includes("--apply");
  console.log("");
  console.log(apply ? "Applying retention. This deletes rows." : "Dry run. Nothing is deleted.");

  const report = runRetentionPrune({
    apply,
    captureProgression: () => {
      const stats = getDashboardStats();
      // force: the interlock reads the newest capture's timestamp, so it has to
      // be written NOW even when the answer has not moved. See ADR-0009.
      return captureAgentProgressionSnapshots(
        { agents: stats.agents, achievements: stats.achievements },
        { force: true },
      );
    },
  });

  if (apply) {
    console.log("");
    console.log("Recorded in retention_prune_runs:");
    for (const run of readRetentionPruneRuns(report.tables.length)) {
      console.log(
        `  ${run.ranAt}  ${run.table}  ${run.outcome}  matched ${run.rowsMatched}  deleted ${run.rowsDeleted}`,
      );
    }
  } else {
    console.log("");
    console.log("Re-run with --apply to delete. Back up first: the deletion is permanent.");
  }

  const refused = report.tables.filter((t) => t.outcome === "refused");
  if (refused.length > 0) process.exit(2);
}

main().catch((err) => {
  console.error("Retention prune failed:", err);
  process.exit(1);
});
