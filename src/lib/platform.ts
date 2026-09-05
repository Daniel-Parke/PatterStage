// ═══════════════════════════════════════════════════════════════
// platform.ts — the single OS-coupling seam for PatterStage
// ═══════════════════════════════════════════════════════════════
// PatterStage runs on Windows, macOS, and Linux. Anything that touches
// the OS the way Linux/macOS used to assume (bash, systemd, nohup, kill -0,
// lsof/ss, crontab, $HOME) goes through here so the rest of the app stays
// platform-agnostic. Node built-ins only → server-side modules only.

import { spawn, execFileSync } from "child_process";
import { connect } from "net";
import { homedir, tmpdir } from "os";

export const isWindows = process.platform === "win32";
export const isMac = process.platform === "darwin";
export const isLinux = process.platform === "linux";

/** User home dir (Windows: USERPROFILE — os.homedir() handles this). */
export const homeDir = (): string => homedir();
/** OS temp dir (cross-platform; never hardcode /tmp). */
export const tmpDir = (): string => tmpdir();

// ── Detached spawn ──────────────────────────────────────────────

export interface DetachedSpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Spawn a process fully detached so it outlives the parent process — used to
 * launch the deploy runner and the restarted next-server. Survival on Windows
 * comes from `stdio:"ignore"` + `unref()` + `windowsHide:true` (not nohup).
 * Returns the child PID, or undefined if it couldn't be observed (mirrors the
 * old `trySpawn` in deploy-spawn.ts: a PID surfaces before ENOENT does).
 */
export function detachedSpawn(
  cmd: string,
  args: string[],
  opts: DetachedSpawnOptions = {},
): number | undefined {
  try {
    const child = spawn(cmd, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      cwd: opts.cwd,
      env: opts.env,
    });
    // Surface failures via undefined pid, not an uncaughtException.
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

// ── Process liveness / kill ─────────────────────────────────────

/** True iff the process exists. `signal 0` is a no-op existence check on all
 *  platforms; EPERM means it exists but we may not signal it (still alive). */
export function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export interface KillOptions {
  /** Also kill the process's child tree (Windows worker processes). */
  tree?: boolean;
}

/** Force-kill a PID (optionally its tree). Best-effort; no throw if already gone. */
export function killPid(pid: number, opts: KillOptions = {}): void {
  if (!Number.isFinite(pid) || pid <= 0) return;
  if (isWindows) {
    try {
      execFileSync(
        "taskkill",
        ["/PID", String(pid), "/F", ...(opts.tree ? ["/T"] : [])],
        { stdio: "ignore" },
      );
    } catch {
      /* already gone */
    }
  } else {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

// ── Port ownership ──────────────────────────────────────────────

/** True iff something is listening on 127.0.0.1:port. A plain TCP connect
 *  probe is fully cross-platform (no lsof/ss/netstat needed). */
export function portInUse(port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const sock = connect({ host: "127.0.0.1", port });
    const finish = (v: boolean) => {
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

/** PIDs listening on a TCP port. Mirrors ps_pids_on_tcp_port (ss → lsof) on
 *  Unix; uses `netstat -ano` on Windows. */
export function pidsOnPort(port: number): number[] {
  const out = new Set<number>();
  if (isWindows) {
    try {
      const txt = execFileSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf-8" });
      for (const line of txt.split(/\r?\n/)) {
        if (!/LISTENING/i.test(line)) continue;
        const cols = line.trim().split(/\s+/);
        const local = cols[1] || ""; // Proto Local Foreign State PID
        if (!local.endsWith(`:${port}`)) continue;
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
    /* fall through to lsof */
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


// ── Host-script interpreter selection ───────────────────────────

export interface Interpreter {
  cmd: string;
  args: string[];
}

let bashCache: string | null | undefined;
/** Resolve a usable bash. Unix: /bin/bash. Windows: first `bash` on PATH
 *  (e.g. Git Bash) or null. */
function resolveBash(): string | null {
  if (bashCache !== undefined) return bashCache;
  if (!isWindows) {
    bashCache = "/bin/bash";
    return bashCache;
  }
  try {
    const out = execFileSync("where", ["bash"], { encoding: "utf-8" });
    bashCache = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || null;
  } catch {
    bashCache = null;
  }
  return bashCache;
}

/**
 * How to execute a host script, chosen by extension + platform. Returns null
 * when there's no interpreter on this OS (caller reports it cleanly rather
 * than blindly invoking /bin/bash).
 */
export function interpreterFor(absPath: string): Interpreter | null {
  const dot = absPath.lastIndexOf(".");
  const ext = dot >= 0 ? absPath.slice(dot).toLowerCase() : "";
  switch (ext) {
    case ".mjs":
    case ".cjs":
    case ".js":
      return { cmd: process.execPath, args: [absPath] };
    case ".ps1":
      return isWindows
        ? { cmd: "powershell.exe", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", absPath] }
        : { cmd: "pwsh", args: ["-NoProfile", "-File", absPath] };
    case ".bat":
    case ".cmd":
      return isWindows ? { cmd: "cmd.exe", args: ["/c", absPath] } : null;
    case ".sh": {
      const bash = resolveBash();
      return bash ? { cmd: bash, args: [absPath] } : null;
    }
    default:
      return null;
  }
}
