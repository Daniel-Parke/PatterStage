#!/usr/bin/env npx tsx
/**
 * Import Hermes disk state into PatterStage SQLite (profiles, root, skills).
 * Usage: npx tsx scripts/tooling/import-hermes-state.ts [--pull]
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

function loadEnvLocal(): void {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf-8");
  for (const line of text.split("\n")) {
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

function applyHermesHomeArg(): void {
  const idx = process.argv.indexOf("--hermes-home");
  if (idx >= 0 && process.argv[idx + 1]) {
    process.env.HERMES_HOME = process.argv[idx + 1].trim().replace(/[/\\]+$/, "");
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  applyHermesHomeArg();
  if (!process.env.PS_DATA_DIR && !process.env.CH_DATA_DIR && !process.env.CONTROL_HUB_DATA_DIR) {
    process.env.PS_DATA_DIR = join(homedir(), "patterstage", "data");
  }

  const hermesHome = process.env.HERMES_HOME || join(homedir(), ".hermes");
  console.log(`HERMES_HOME=${hermesHome}`);
  console.log(`PS_DATA_DIR=${process.env.PS_DATA_DIR || process.env.CH_DATA_DIR}`);

  const pull = process.argv.includes("--pull");

  const { importHermesStateFromDisk } = await import("../../src/modules/hermes/lib/state-import");
  const result = importHermesStateFromDisk(pull ? { force: true } : undefined);

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
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
