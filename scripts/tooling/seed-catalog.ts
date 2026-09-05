#!/usr/bin/env npx tsx
/**
 * Seed PatterStage professional catalog into SQLite and push profiles to Hermes.
 * Usage: npx tsx scripts/tooling/seed-catalog.ts [--merge|--replace]
 */

import { readFileSync, existsSync } from "fs";
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

  const args = process.argv.slice(2);
  const mode = args.includes("--replace") ? "replace" : "merge";
  const confirmOverride = args.includes("--confirm-override");

  const { runCatalogSeed } = await import("../../src/lib/seed/catalog-seed");
  const result = runCatalogSeed({ target: "all", mode, confirmOverride });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
