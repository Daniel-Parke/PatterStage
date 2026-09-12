#!/usr/bin/env node
// ps-system-report.mjs — host health snapshot (read-only). Cross-platform.
// OS, uptime, load, memory, CPU, and a best-effort busiest-process list.

import { execFileSync } from "child_process";
import os from "os";

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const gib = (n) => `${(n / 1024 ** 3).toFixed(2)} GiB`;

log("── Host ──");
log(`${os.type()} ${os.release()} (${os.arch()}) · host ${os.hostname()}`);
log(`uptime ${Math.round(os.uptime() / 3600)}h · cpus ${os.cpus().length}`);
const load = os.loadavg();
if (load[0] > 0) log(`load ${load.map((n) => n.toFixed(2)).join(" ")}`);

log("── Memory ──");
log(`total ${gib(os.totalmem())} · free ${gib(os.freemem())} · used ${gib(os.totalmem() - os.freemem())}`);

log("── Top processes ──");
try {
  if (process.platform === "win32") {
    const out = execFileSync("tasklist", ["/FO", "CSV", "/NH"], { encoding: "utf-8" });
    out
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 8)
      .forEach((l) => log(l.replace(/","/g, " · ").replace(/^"|"$/g, "")));
  } else {
    const out = execFileSync("/bin/sh", ["-c", "ps aux | sort -rk3 | head -8"], { encoding: "utf-8" });
    out.split(/\r?\n/).filter(Boolean).forEach((l) => log(l));
  }
} catch {
  log("(process list unavailable)");
}
log("system report complete");
