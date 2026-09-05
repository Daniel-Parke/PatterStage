#!/usr/bin/env npx tsx
/**
 * Re-apply Models registry defaults to ~/.hermes/config.yaml without profile push.
 * Used after deploy import/seed so disk model section stays aligned with SQLite.
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

async function main(): Promise<void> {
  loadEnvLocal();
  if (!process.env.PS_DATA_DIR && !process.env.CH_DATA_DIR && !process.env.CONTROL_HUB_DATA_DIR) {
    process.env.PS_DATA_DIR = join(homedir(), "patterstage", "data");
  }

  const hermesHome = (process.env.HERMES_HOME || join(homedir(), ".hermes")).replace(
    /[/\\]+$/,
    "",
  );
  const configPath = hermesHome + "/config.yaml";

  if (!existsSync(configPath)) {
    console.log(JSON.stringify({ skipped: true, reason: "no config.yaml" }));
    return;
  }

  const { ensureDb } = await import("../../src/lib/db");
  const { getModelDefaults } = await import("../../src/lib/models-repository");
  const { finalizeRootConfigOnDisk } = await import("../../src/modules/hermes/lib/config-sync");

  ensureDb();
  const defaults = getModelDefaults();
  if (!defaults.agent) {
    console.log(JSON.stringify({ skipped: true, reason: "no model_defaults.agent" }));
    return;
  }

  const result = finalizeRootConfigOnDisk();
  console.log(
    JSON.stringify({
      skipped: false,
      appliedModelDefaults: result.appliedModelDefaults,
      backupPath: result.backupPath,
    }),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
