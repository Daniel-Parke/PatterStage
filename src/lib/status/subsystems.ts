// ═══════════════════════════════════════════════════════════════
// subsystems.ts: is each thing this product depends on up, and why not
//
// Round 6's second architecture recommendation (T-0091, ruling 2). The
// dashboard had pieces of this scattered across /api/status, /api/monitor
// and the memory tile, none of them saying "reachable" or "not, because".
// Five rows, each with a state a person can read in words and a reason they
// can act on. The collector takes its dependencies as functions so the rules
// are provable without a gateway, a database or a scheduler in the room;
// `liveSubsystemDeps` binds the real ones.
//
// One dependency throwing does not take the others with it: a row that
// cannot be checked says so and the rest still render.
// ═══════════════════════════════════════════════════════════════

import { runtime } from "@/lib/runtime";
import { resolveEndpoint } from "@/lib/runtime/endpoint-registry";
import { getDefaultGatewayGate, type GateSnapshot } from "@/lib/runtime/gateway-gate";
import { RuntimeRequestError, type HealthReport } from "@/lib/runtime/types";
import { getActiveMemoryProvider, getMemoryProviderType } from "@/lib/memory/memory-providers";
import type { MemoryHealth } from "@/lib/memory/memory-providers/types";
import { getSyncScheduler } from "@/lib/sync";
import { getSystemStat } from "@/lib/system-repository";
import { messageFromError } from "@/lib/api-fetch";

export type SubsystemState = "ok" | "degraded" | "down";
type SubsystemId = "gateway" | "memory" | "sync" | "config" | "gate";

export interface SubsystemRow {
  id: SubsystemId;
  label: string;
  state: SubsystemState;
  /** What a person can act on. Never empty. */
  reason: string;
  /** The gateway row only: the base URL it probed, for callers that need the address as data. */
  url?: string;
}

export interface SubsystemSummary {
  checkedAt: string;
  subsystems: SubsystemRow[];
}

interface SyncCycleFacts {
  completedAt: string;
  allSuccessful: boolean;
  results: unknown[];
  errorsBySource: Record<string, string>;
}

export interface SubsystemDeps {
  gatewayBaseUrl: () => string;
  probeGateway: () => Promise<HealthReport>;
  memoryProviderType: () => string;
  memoryHealth: () => Promise<MemoryHealth>;
  lastSyncCycle: () => SyncCycleFacts | null;
  systemStat: (key: string) => string | null;
  gateSnapshot: () => GateSnapshot;
}

const PROBE_TIMEOUT_MS = 5_000;

async function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} gave no answer within ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** A row that could not be checked still renders, and says why. */
async function guarded(id: SubsystemId, label: string, check: () => Promise<SubsystemRow>): Promise<SubsystemRow> {
  try {
    return await check();
  } catch (err) {
    return { id, label, state: "degraded", reason: `could not check: ${messageFromError(err, "unknown error")}` };
  }
}

export async function collectSubsystems(deps: SubsystemDeps): Promise<SubsystemSummary> {
  const rows = await Promise.all([
    guarded("gateway", "Gateway", async () => {
      const base = deps.gatewayBaseUrl();
      try {
        const report = await withTimeout(deps.probeGateway(), PROBE_TIMEOUT_MS, `the gateway at ${base}`);
        return report.ok
          ? { id: "gateway", label: "Gateway", state: "ok", reason: `reachable at ${base}`, url: base }
          : { id: "gateway", label: "Gateway", state: "down", reason: `${base} answered the health probe with ok=false`, url: base };
      } catch (err) {
        if (err instanceof RuntimeRequestError && (err.status === 401 || err.status === 403)) {
          return { id: "gateway", label: "Gateway", state: "down", reason: `${base} rejects our API key (${err.status} unauthorized). Check HERMES_API_KEY on both sides.` };
        }
        return { id: "gateway", label: "Gateway", state: "down", reason: messageFromError(err, `could not reach ${base}`) };
      }
    }),
    guarded("memory", "Memory", async () => {
      const type = deps.memoryProviderType();
      try {
        const h = await withTimeout(deps.memoryHealth(), PROBE_TIMEOUT_MS, `the ${type} memory provider`);
        if (h.available) return { id: "memory", label: "Memory", state: "ok", reason: `${type} is answering${h.status ? ` (${h.status})` : ""}` };
        // Memory is optional: the agent runs without it, so this is degraded, not down.
        return { id: "memory", label: "Memory", state: "degraded", reason: `${type}: ${h.error ?? h.status ?? "not available"}` };
      } catch (err) {
        return { id: "memory", label: "Memory", state: "degraded", reason: `${type}: ${messageFromError(err, "health check failed")}` };
      }
    }),
    guarded("sync", "Sync", async () => {
      const cycle = deps.lastSyncCycle();
      if (!cycle) return { id: "sync", label: "Sync", state: "degraded", reason: "no sync cycle has completed yet since this process started" };
      if (cycle.allSuccessful) return { id: "sync", label: "Sync", state: "ok", reason: `last cycle clean at ${cycle.completedAt}` };
      const failing = Object.entries(cycle.errorsBySource).map(([name, msg]) => `${name}: ${msg}`);
      return { id: "sync", label: "Sync", state: "degraded", reason: failing.length ? `failing: ${failing.join("; ")}` : `last cycle at ${cycle.completedAt} had a failing source` };
    }),
    guarded("config", "config.yaml", async () => {
      const parseError = deps.systemStat("config.yaml_error");
      if (parseError) return { id: "config", label: "config.yaml", state: "down", reason: `does not parse: ${parseError}. Pushes and pulls refuse until it is repaired.` };
      if (deps.systemStat("config.present") !== "true") return { id: "config", label: "config.yaml", state: "degraded", reason: "no config.yaml found in the Hermes home" };
      return { id: "config", label: "config.yaml", state: "ok", reason: "present and parses" };
    }),
    guarded("gate", "Gateway gate", async () => {
      const s = deps.gateSnapshot();
      const saturated = Object.entries(s.endpoints).find(([, e]) => e.inFlight >= s.limits.maxInFlight || e.queued > 0);
      if (saturated) {
        const [url, e] = saturated;
        return { id: "gate", label: "Gateway gate", state: "degraded", reason: `${url} is at its limit: ${e.inFlight} in flight (limit ${s.limits.maxInFlight}), ${e.queued} queued` };
      }
      if (s.refused > 0) return { id: "gate", label: "Gateway gate", state: "degraded", reason: `${s.admitted} admitted, ${s.refused} refused since start; the gateway has not been keeping up` };
      return { id: "gate", label: "Gateway gate", state: "ok", reason: `${s.admitted} admitted, 0 refused` };
    }),
  ]);
  return { checkedAt: new Date().toISOString(), subsystems: rows };
}

/** The real dependencies, bound at the HTTP edge. */
export function liveSubsystemDeps(): SubsystemDeps {
  return {
    gatewayBaseUrl: () => resolveEndpoint().baseUrl,
    probeGateway: () => runtime.health(),
    memoryProviderType: () => getMemoryProviderType(),
    memoryHealth: () => getActiveMemoryProvider().health(),
    lastSyncCycle: () => {
      const scheduler = getSyncScheduler();
      const cycle = scheduler?.getLastCycleResult() ?? null;
      if (!cycle) return null;
      return {
        completedAt: cycle.completedAt,
        allSuccessful: cycle.allSuccessful,
        results: cycle.results,
        errorsBySource: scheduler?.getLastErrorBySource() ?? {},
      };
    },
    systemStat: (key) => getSystemStat(key) ?? null,
    gateSnapshot: () => getDefaultGatewayGate().snapshot(),
  };
}
