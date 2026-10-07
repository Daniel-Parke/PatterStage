#!/usr/bin/env npx tsx
/**
 * Seed PatterStage professional catalog into SQLite and push profiles to Hermes.
 * Usage: npx tsx scripts/tooling/seed-catalog.ts [--merge|--replace]
 */

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

  const args = process.argv.slice(2);
  const mode = args.includes("--replace") ? "replace" : "merge";
  const confirmOverride = args.includes("--confirm-override");

  const { runCatalogSeed } = await import("../../src/lib/seed/catalog-seed");
  const result = runCatalogSeed({ target: "all", mode, confirmOverride, strictSeedFailures: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
  void err;
  console.error("Catalog seed failed; required input or a seed operation could not be completed.");
  process.exitCode = 1;
});
