#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// boot-smoke.mjs — cross-platform operational smoke (no app build / no Hermes)
// ═══════════════════════════════════════════════════════════════
// The CI `boot-smoke` matrix runs this on ubuntu + macos (ci.yml). It exercises
// the OS-seam primitives the deploy runner and host scheduler depend on — the
// code most likely to differ per OS — without needing a full Next build or a
// running Hermes:
//   • detachedSpawn survives + isPidAlive + killPid actually terminate it
//   • portInUse / pidsOnPort observe a real listener and clear after close
//   • a bundled cross-platform hardware .mjs runs to completion
// Side-effect-free (no writes to the working tree). Exits non-zero on failure.

import { spawnSync } from "child_process";
import { createServer } from "net";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  detachedSpawn, isPidAlive, killPid, portInUse, pidsOnPort,
} from "../../scripts/tooling/_platform.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
}

console.log(`boot-smoke on ${process.platform} (node ${process.version})`);

// 1. Detached spawn survives, is observable, and can be killed.
const child = detachedSpawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], {});
check("detachedSpawn returns a live pid", typeof child === "number" && child > 0);
await sleep(600);
check("isPidAlive true while child runs", isPidAlive(child));
killPid(child, { tree: true });
await sleep(900);
check("isPidAlive false after killPid", !isPidAlive(child));

// 2. Port observation against a real listener.
const port = 42087;
const srv = createServer();
await new Promise((resolve, reject) => {
  srv.once("error", reject);
  srv.listen(port, "127.0.0.1", resolve);
});
check("portInUse true while listening", await portInUse(port));
const owners = pidsOnPort(port); // best-effort across OS tools — informational only
console.log(`      pidsOnPort(${port}) -> [${owners.join(", ")}]`);
await new Promise((resolve) => srv.close(resolve));
await sleep(400);
check("portInUse false after close", !(await portInUse(port)));

// 3. A bundled cross-platform hardware script runs to completion.
const rep = spawnSync(process.execPath, [join(REPO, "scripts/hardware/ps-system-report.mjs")], {
  encoding: "utf-8",
});
check("ps-system-report.mjs exits 0", rep.status === 0 && /system report complete/.test(rep.stdout || ""));

console.log(failures === 0 ? "\nboot-smoke OK" : `\nboot-smoke FAILED (${failures} check(s))`);
process.exit(failures === 0 ? 0 : 1);
