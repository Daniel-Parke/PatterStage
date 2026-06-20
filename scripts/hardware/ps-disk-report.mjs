#!/usr/bin/env node
// ps-disk-report.mjs — disk usage snapshot (read-only). Cross-platform.
//   PS_DATA_DIR / HERMES_HOME

import { existsSync, statfsSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";

function dataDir() {
  const raw = process.env.PS_DATA_DIR || process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR;
  if (raw && raw.trim()) return raw.trim().replace(/[/\\]+$/, "");
  const next = join(homedir(), "patterstage", "data");
  const legacy = join(homedir(), "control-hub", "data");
  return !existsSync(next) && existsSync(legacy) ? legacy : next;
}
const HERMES_HOME = process.env.HERMES_HOME || join(homedir(), ".hermes");
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const gib = (n) => `${(n / 1024 ** 3).toFixed(2)} GiB`;

function dirSize(p, budget = { files: 200_000 }) {
  let total = 0;
  let entries;
  try {
    entries = readdirSync(p, { withFileTypes: true });
  } catch {
    return total;
  }
  for (const e of entries) {
    if (budget.files-- <= 0) break;
    const abs = join(p, e.name);
    try {
      if (e.isDirectory()) total += dirSize(abs, budget);
      else total += statSync(abs).size;
    } catch {
      /* skip */
    }
  }
  return total;
}

log("── Filesystem (data dir) ──");
try {
  const fs = statfsSync(dataDir() && existsSync(dataDir()) ? dataDir() : homedir());
  const totalB = fs.blocks * fs.bsize;
  const freeB = fs.bavail * fs.bsize;
  log(`total ${gib(totalB)} · free ${gib(freeB)} · used ${gib(totalB - freeB)}`);
} catch {
  log("(statfs unavailable on this Node/OS)");
}

for (const d of [dataDir(), HERMES_HOME]) {
  if (existsSync(d)) {
    log(`── ${d} ──`);
    log(`size ${gib(dirSize(d))}`);
  } else {
    log(`(skip) ${d} does not exist`);
  }
}
log("disk report complete");
