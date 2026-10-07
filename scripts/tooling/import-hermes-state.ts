#!/usr/bin/env npx tsx
/**
 * Import Hermes disk state into PatterStage SQLite (profiles, root, skills).
 * Usage: npx tsx scripts/tooling/import-hermes-state.ts [--pull | --import-missing-profiles]
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./load-env-local";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");


function applyHermesHomeArg(): void {
  const idx = process.argv.indexOf("--hermes-home");
  if (idx >= 0 && process.argv[idx + 1]) {
    process.env.HERMES_HOME = process.argv[idx + 1].trim().replace(/[/\\]+$/, "");
  }
}

async function main(): Promise<void> {
  loadEnvLocal(ROOT);
  applyHermesHomeArg();
  if (!process.env.PS_DATA_DIR && !process.env.CH_DATA_DIR && !process.env.CONTROL_HUB_DATA_DIR) {
    process.env.PS_DATA_DIR = join(homedir(), "patterstage", "data");
  }

  const hermesHome = process.env.HERMES_HOME || join(homedir(), ".hermes");
  console.log(`HERMES_HOME=${hermesHome}`);
  console.log(`PS_DATA_DIR=${process.env.PS_DATA_DIR || process.env.CH_DATA_DIR}`);

  const pull = process.argv.includes("--pull");
  const importMissingProfiles = process.argv.includes("--import-missing-profiles");
  if (pull && importMissingProfiles) throw new Error("Choose either --pull or --import-missing-profiles");

  const { importHermesStateFromDisk } = await import("../../src/modules/hermes/lib/state-import");
  const result = importHermesStateFromDisk({ force: pull, strict: true, importMissingProfiles });

  console.log(
    JSON.stringify(
      {
        skills: result.skills.filter((r) => r.success).length,
        root: result.root.success,
        profiles: result.profiles.filter((r) => r.success).length,
        pull,
      },
      null,
      2,
    ),
  );
  if (!result.root.success || result.skills.some((item) => !item.success) ||
      result.profiles.some((item) => !item.success)) {
    console.error("Hermes state import failed; root, skill or profile was not imported.");
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  void err;
  console.error("Hermes state import failed; inspect local Hermes state and retry after repair. --pull refreshes existing rows.");
  process.exitCode = 1;
});
