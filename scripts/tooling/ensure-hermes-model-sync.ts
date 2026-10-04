#!/usr/bin/env npx tsx
/**
 * Re-apply Models registry defaults to ~/.hermes/config.yaml without profile push.
 * Used after deploy import/seed so disk model section stays aligned with SQLite.
 */

import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./load-env-local";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");


async function main(): Promise<void> {
  loadEnvLocal(ROOT);
  if (!process.env.PS_DATA_DIR && !process.env.CH_DATA_DIR && !process.env.CONTROL_HUB_DATA_DIR) {
    process.env.PS_DATA_DIR = join(homedir(), "patterstage", "data");
  }

  const hermesHome = (process.env.HERMES_HOME || join(homedir(), ".hermes")).replace(
    /[/\\]+$/,
    "",
  );
  const configPath = hermesHome + "/config.yaml";

  if (!existsSync(configPath)) {
    if (process.argv.includes("--require-config")) {
      console.error("Hermes model sync failed; required config.yaml is missing.");
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({ skipped: true, reason: "no config.yaml" }));
    return;
  }

  const { ensureDb } = await import("../../src/lib/db");
  const { getModelDefaults } = await import("../../src/lib/models/models-repository");
  const { finalizeRootConfigOnDisk } = await import("../../src/modules/hermes/lib/config-sync");

  ensureDb();
  const defaults = getModelDefaults();
  if (!defaults.agent) {
    console.log(JSON.stringify({ skipped: true, reason: "no model_defaults.agent" }));
    return;
  }

  const result = finalizeRootConfigOnDisk();
  if (result.error) {
    console.error("Hermes model sync failed; config defaults were not applied.");
    process.exitCode = 1;
  }
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
