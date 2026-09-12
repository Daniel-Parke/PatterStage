// _platform.mjs — plain-ESM mirror of the deploy-relevant bits of
// src/lib/host/platform.ts. The deploy runner (ps-deploy.mjs) runs in plain `node`
// (outside the Next build) so it cannot import the TS module; keep this small
// surface in sync with platform.ts.

import { spawn, execFileSync } from "child_process";
import { connect } from "net";
import { chmodSync, openSync } from "fs";

export const isWindows = process.platform === "win32";

// Mirrors OWNER_ONLY_FILE/restrictToOwner in src/lib/fs/fs-helpers.ts. There is
// no OWNER_ONLY_DIR here: the only directory the runner makes is ~/.hermes/logs,
// which belongs to Hermes rather than to PatterStage, so this narrows the log
// FILES it writes and leaves someone else's directory alone.
/** Owner read/write. The mode for anything holding an operator's data. */
export const OWNER_ONLY_FILE = 0o600;

/** Narrow an existing path to its owner. A mode argument only applies on
 *  creation, and these files outlive the install that made them. No-op on
 *  Windows, and silent on a path that is not there. */
export function restrictToOwner(path, mode) {
  if (isWindows) return;
  try {
    chmodSync(path, mode);
  } catch {
    /* best effort */
  }
}

/** Spawn fully detached so it outlives this process. `logFile` (if given) is
 *  opened in append mode and used for the child's stdout+stderr (a file fd —
 *  required for survival on Windows; pipes would tie the child to us). */
export function detachedSpawn(cmd, args, { cwd, env, logFile } = {}) {
  try {
    let stdio = "ignore";
    if (logFile) {
      // The server's stdout goes here, and the boot line carries the access
      // token. Mode on create, chmod for the log the last start left behind.
      const fd = openSync(logFile, "a", OWNER_ONLY_FILE);
      restrictToOwner(logFile, OWNER_ONLY_FILE);
      stdio = ["ignore", fd, fd];
    }
    const child = spawn(cmd, args, {
      detached: true,
      stdio,
      windowsHide: true,
      cwd,
      env,
    });
    child.on("error", () => {});
    if (typeof child.pid === "number" && child.pid > 0) {
      child.unref();
      return child.pid;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function isPidAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === "EPERM";
  }
}

export function killPid(pid, { tree = false } = {}) {
  if (!Number.isFinite(pid) || pid <= 0) return;
  if (isWindows) {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/F", ...(tree ? ["/T"] : [])], { stdio: "ignore" });
    } catch {
      /* gone */
    }
  } else {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }
}

export function pidsOnPort(port) {
  const out = new Set();
  if (isWindows) {
    try {
      const txt = execFileSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf-8" });
      for (const line of txt.split(/\r?\n/)) {
        if (!/LISTENING/i.test(line)) continue;
        const cols = line.trim().split(/\s+/);
        if (!(cols[1] || "").endsWith(`:${port}`)) continue;
        const pid = Number(cols[cols.length - 1]);
        if (Number.isFinite(pid) && pid > 0) out.add(pid);
      }
    } catch {
      /* ignore */
    }
    return [...out];
  }
  try {
    const txt = execFileSync("ss", ["-tlnp", `sport = :${port}`], { encoding: "utf-8" });
    for (const m of txt.matchAll(/pid=(\d+)/g)) out.add(Number(m[1]));
    if (out.size) return [...out];
  } catch {
    /* lsof next */
  }
  try {
    const txt = execFileSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf-8" });
    for (const l of txt.split(/\r?\n/)) {
      const n = Number(l.trim());
      if (n > 0) out.add(n);
    }
  } catch {
    /* ignore */
  }
  return [...out];
}

export function killByPort(port) {
  for (const pid of pidsOnPort(port)) killPid(pid, { tree: true });
}

export function portInUse(port, timeoutMs = 500) {
  return new Promise((resolve) => {
    let done = false;
    const sock = connect({ host: "127.0.0.1", port });
    const finish = (v) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
  });
}
