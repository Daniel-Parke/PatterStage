#!/usr/bin/env node
// ps-log-rotate.mjs — gzip + prune PatterStage hardware-script logs.
// Compresses *.log not modified in >1 day; deletes *.log.gz older than the
// retention window. Cross-platform. Only touches *.log/*.log.gz in the log dir.
//   PS_DATA_DIR / PS_HARDWARE_LOG_DIR / PS_LOG_RETENTION_DAYS (30)

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { gzipSync } from "zlib";
import { homedir } from "os";
import { join } from "path";

function dataDir() {
  const raw = process.env.PS_DATA_DIR || process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR;
  if (raw && raw.trim()) return raw.trim().replace(/[/\\]+$/, "");
  const next = join(homedir(), "patterstage", "data");
  const legacy = join(homedir(), "control-hub", "data");
  return !existsSync(next) && existsSync(legacy) ? legacy : next;
}
const log = (m) => console.log(`[${new Date().toISOString()}] [ps-log-rotate] ${m}`);

const LOG_DIR = process.env.PS_HARDWARE_LOG_DIR || join(dataDir(), "logs");
const RETENTION = Number(process.env.PS_LOG_RETENTION_DAYS || 30);
const DAY = 86_400_000;

if (!existsSync(LOG_DIR)) {
  log(`(skip) log dir does not exist: ${LOG_DIR}`);
  process.exit(0);
}

const now = Date.now();
let gz = 0;
let pruned = 0;
for (const name of readdirSync(LOG_DIR)) {
  const abs = join(LOG_DIR, name);
  let st;
  try {
    st = statSync(abs);
  } catch {
    continue;
  }
  if (!st.isFile()) continue;
  const ageDays = (now - st.mtimeMs) / DAY;
  if (name.endsWith(".log") && ageDays > 1) {
    try {
      writeFileSync(`${abs}.gz`, gzipSync(readFileSync(abs)));
      unlinkSync(abs);
      gz++;
      log(`compressed ${name}`);
    } catch {
      /* skip */
    }
  } else if (name.endsWith(".log.gz") && ageDays > RETENTION) {
    try {
      unlinkSync(abs);
      pruned++;
      log(`pruned ${name}`);
    } catch {
      /* skip */
    }
  }
}
log(`rotate complete (compressed=${gz} pruned=${pruned}, retention=${RETENTION}d)`);
