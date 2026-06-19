// ═══════════════════════════════════════════════════════════════
// runtime/gateway-manager.ts — ephemeral per-profile benchmark gateways
//
// Hermes serves exactly ONE profile per gateway (the one its HERMES_HOME points
// at) and /v1/runs has no agent selector — so the only way to benchmark a
// specific agent CONFIG (skills/tools/memory toggles) agentically is to run a
// gateway that serves that config. This manager spawns a short-lived
// `hermes gateway run` bound to the ephemeral __bench_<runId> profile on its own
// free port + key, waits for /health, and registers it so resolveEndpoint() and
// getGatewayKey() route that profile's runs to it. teardown kills the process.
//
// Capability-gated: when the `hermes` binary is not reachable from this process
// (e.g. Hermes is a separate container / remote host) gatewaySpawnAvailable()
// is false and callers fall back to the shared default gateway — agentic runs
// then exercise the default agent and the UI flags toggles as not applied.
//
// SERVER-ONLY (uses child_process / net / fs); never import into client code.
// ═══════════════════════════════════════════════════════════════

import { spawn } from "child_process";
import { createServer } from "net";
import { randomBytes } from "crypto";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { delimiter, join } from "path";
import { db } from "@/lib/db";
import { resolveProfileHermesHome } from "@/lib/hermes-profile-paths";
import { logApiError } from "@/lib/api-logger";

export interface BenchGateway {
  slug: string;
  runId: string;
  pid: number;
  host: string;
  port: number;
  home: string;
  key: string;
}

/** Fast path: live gateways owned by THIS Control Hub process. */
const registry = new Map<string, BenchGateway>();

// ── Capability detection (resolve the hermes binary) ─────────────

let _binResolved: string | null | undefined;

function isExecutable(p: string): boolean {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Absolute path to a runnable `hermes`, or null when none is reachable. */
export function resolveHermesBin(): string | null {
  if (_binResolved !== undefined) return _binResolved;
  const override = process.env.HERMES_BIN?.trim();
  if (override) {
    _binResolved = isExecutable(override) ? override : null;
    return _binResolved;
  }
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of (process.env.PATH || "").split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const cand = join(dir, `hermes${ext}`);
      if (isExecutable(cand)) {
        _binResolved = cand;
        return cand;
      }
    }
  }
  _binResolved = null;
  return null;
}

/** True when this process can spawn a Hermes gateway locally. */
export function gatewaySpawnAvailable(): boolean {
  return resolveHermesBin() !== null;
}

/** Test seam: forget the cached binary resolution. */
export function _resetHermesBinCache(): void {
  _binResolved = undefined;
}

// ── Helpers ──────────────────────────────────────────────────────

function allocPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error("could not allocate a port"))));
    });
  });
}

function randomKey(): string {
  return `bench_${randomBytes(18).toString("hex")}`;
}

/** Write the API-server env the gateway reads from HERMES_HOME/.env. */
function writeGatewayEnv(home: string, port: number, key: string): void {
  mkdirSync(home, { recursive: true });
  const envPath = join(home, ".env");
  const kept: string[] = [];
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      if (/^\s*API_SERVER_(ENABLED|HOST|PORT|KEY)\s*=/.test(line)) continue;
      if (line.trim().length === 0) continue;
      kept.push(line);
    }
  }
  const block = [
    "API_SERVER_ENABLED=true",
    "API_SERVER_HOST=127.0.0.1",
    `API_SERVER_PORT=${port}`,
    `API_SERVER_KEY=${key}`,
  ];
  writeFileSync(envPath, [...kept, ...block].join("\n") + "\n", { mode: 0o600 });
}

async function waitForHealth(base: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (signal?.aborted) return false;
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Guard against PID reuse: only signal a pid that is actually a hermes gateway. */
function isHermesGatewayPid(pid: number): boolean {
  try {
    const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf-8");
    return cmd.includes("hermes") && cmd.includes("gateway");
  } catch {
    // /proc unavailable (non-Linux) — the spawn path only runs on Linux, so a
    // missing /proc means we can't verify; err on NOT killing.
    return process.platform !== "linux" ? false : false;
  }
}

function killPid(pid: number): void {
  // Bench gateways are disposable — SIGKILL immediately so the teardown that
  // follows can remove the profile dir without racing a graceful shutdown.
  if (!isHermesGatewayPid(pid)) return;
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}

function persist(gw: BenchGateway): void {
  try {
    db()
      .prepare(
        `INSERT OR REPLACE INTO bench_gateways (slug, run_id, pid, host, port, home, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(gw.slug, gw.runId, gw.pid, gw.host, gw.port, gw.home, new Date().toISOString());
  } catch (e) {
    logApiError("benchmarks.gateway.persist", gw.slug, e);
  }
}

// ── Lifecycle ────────────────────────────────────────────────────

export interface EnsureGatewayOptions {
  runId: string;
  /** Max wait for /health before giving up. Default 60s. */
  healthTimeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Spawn (or reuse) a gateway serving the ephemeral profile `slug`. Returns the
 * live gateway, or null when spawning isn't available/failed — in which case the
 * caller routes the run to the shared default gateway (toggles won't apply).
 */
export async function ensureBenchGateway(
  slug: string,
  opts: EnsureGatewayOptions,
): Promise<BenchGateway | null> {
  const existing = registry.get(slug);
  if (existing) return existing;

  const bin = resolveHermesBin();
  if (!bin) return null;

  try {
    const home = resolveProfileHermesHome(slug);
    const port = await allocPort();
    const key = randomKey();
    writeGatewayEnv(home, port, key);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HERMES_HOME: home,
      AGENT_HOME: home,
      API_SERVER_ENABLED: "true",
      API_SERVER_HOST: "127.0.0.1",
      API_SERVER_PORT: String(port),
      API_SERVER_KEY: key,
    };
    // Hermes refuses to run the gateway as root by default (root-owned state).
    // Only when Control Hub itself is root do we opt in.
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      env.HERMES_ALLOW_ROOT_GATEWAY = "1";
    }

    const child = spawn(bin, ["gateway", "run", "--no-supervise"], {
      env,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    if (!child.pid) throw new Error("gateway process did not start");

    const base = `http://127.0.0.1:${port}`;
    const healthy = await waitForHealth(base, opts.healthTimeoutMs ?? 60_000, opts.signal);
    if (!healthy) {
      try {
        process.kill(child.pid, "SIGKILL");
      } catch {
        /* gone */
      }
      throw new Error(`gateway for ${slug} never became healthy on :${port}`);
    }

    const gw: BenchGateway = { slug, runId: opts.runId, pid: child.pid, host: "127.0.0.1", port, home, key };
    registry.set(slug, gw);
    persist(gw);
    return gw;
  } catch (err) {
    logApiError("benchmarks.gateway.spawn", slug, err);
    return null;
  }
}

/** Endpoint for a live bench gateway, or null when none is registered. */
export function getBenchGatewayEndpoint(slug: string): { baseUrl: string; apiKey: string } | null {
  const gw = registry.get(slug);
  if (!gw) return null;
  return { baseUrl: `http://${gw.host}:${gw.port}`, apiKey: gw.key };
}

/** Bearer key for a live bench gateway, or null. */
export function getBenchGatewayKey(slug: string): string | null {
  return registry.get(slug)?.key ?? null;
}

/** Kill + deregister the gateway for `slug` (no-op when none). */
export function killBenchGateway(slug: string): void {
  const gw = registry.get(slug);
  if (gw) {
    killPid(gw.pid);
    registry.delete(slug);
  }
  try {
    db().prepare(`DELETE FROM bench_gateways WHERE slug = ?`).run(slug);
  } catch {
    /* table may not exist yet */
  }
}

/** Boot sweep: kill gateways left running by a crashed Control Hub. */
export function sweepOrphanBenchGateways(): void {
  let rows: Array<{ pid: number | null }> = [];
  try {
    rows = db().prepare(`SELECT pid FROM bench_gateways`).all() as Array<{ pid: number | null }>;
  } catch {
    return;
  }
  for (const row of rows) {
    if (row.pid) killPid(row.pid);
  }
  try {
    db().prepare(`DELETE FROM bench_gateways`).run();
  } catch {
    /* ignore */
  }
  registry.clear();
}
