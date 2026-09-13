// ═══════════════════════════════════════════════════════════════
// gateway-gate.ts: bounded admission to the Hermes gateway, per endpoint
//
// Round 6's architecture note asked for a circuit breaker on the LLM
// endpoint (T-0090, ruling 2). What this process actually needs is narrower
// and provable: a stalled gateway must not pile up unbounded in-flight
// requests here, must not queue callers forever, and must not starve a
// healthy endpoint behind a slow one. So: a slot count per endpoint, a
// bounded FIFO behind it with a bounded wait, and a refusal beyond that which
// says what it is and where. Saturation is a 503 naming the gate, never a
// hang the operator has to diagnose from a spinner.
//
// The gate sits inside HermesRuntime.fetchJson, so every caller that goes
// through the runtime (mission dispatch, chat, composer, research, the
// reconciler) shares it without knowing it exists. Streams are exempt: an
// SSE subscription is open for the life of a run and would hold a slot for
// minutes; the gate is for the request/response calls that pile up.
//
// It publishes a snapshot; the subsystem health summary (T-0091) reads it.
// ═══════════════════════════════════════════════════════════════

import { RuntimeRequestError } from "./types";

export interface GateLimits {
  /** Concurrent requests allowed per endpoint. */
  maxInFlight: number;
  /** Callers allowed to wait for a slot, per endpoint. 0 means refuse at once. */
  maxQueue: number;
  /** How long a queued caller waits before it is refused. */
  queueTimeoutMs: number;
}

interface EndpointGateSnapshot {
  inFlight: number;
  queued: number;
  admitted: number;
  refused: number;
}

export interface GateSnapshot {
  limits: GateLimits;
  admitted: number;
  refused: number;
  endpoints: Record<string, EndpointGateSnapshot>;
}

/** A 503 the HTTP edge can pass straight through. */
export class GatewayGateSaturatedError extends RuntimeRequestError {
  constructor(message: string) {
    super(message, 503);
    this.name = "GatewayGateSaturatedError";
  }
}

const DEFAULTS: GateLimits = { maxInFlight: 8, maxQueue: 32, queueTimeoutMs: 10_000 };

function intFrom(raw: string | undefined, fallback: number, min: number): number {
  const n = Number(raw);
  if (raw === undefined || raw === "" || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

/** Limits from the environment. Junk never disables the gate. */
export function gateLimitsFromEnv(env: Record<string, string | undefined>): GateLimits {
  return {
    maxInFlight: intFrom(env.PS_GATEWAY_MAX_INFLIGHT, DEFAULTS.maxInFlight, 1),
    maxQueue: intFrom(env.PS_GATEWAY_MAX_QUEUE, DEFAULTS.maxQueue, 0),
    queueTimeoutMs: intFrom(env.PS_GATEWAY_QUEUE_TIMEOUT_MS, DEFAULTS.queueTimeoutMs, 0),
  };
}

interface Waiter {
  admit: () => void;
  refuse: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface EndpointState {
  inFlight: number;
  queue: Waiter[];
  admitted: number;
  refused: number;
}

export class GatewayGate {
  private readonly limits: GateLimits;
  private readonly endpoints = new Map<string, EndpointState>();
  private admitted = 0;
  private refused = 0;

  constructor(limits: Partial<GateLimits> = {}) {
    this.limits = { ...DEFAULTS, ...limits };
  }

  private state(endpoint: string): EndpointState {
    let s = this.endpoints.get(endpoint);
    if (!s) {
      s = { inFlight: 0, queue: [], admitted: 0, refused: 0 };
      this.endpoints.set(endpoint, s);
    }
    return s;
  }

  private saturated(endpoint: string, s: EndpointState): GatewayGateSaturatedError {
    return new GatewayGateSaturatedError(
      `gateway gate saturated for ${endpoint}: ${s.inFlight} in flight (limit ${this.limits.maxInFlight}), ` +
        `${s.queue.length} queued (limit ${this.limits.maxQueue}). The gateway is not keeping up; try again shortly.`,
    );
  }

  /** Run `fn` inside the endpoint's gate. Refuses rather than waits past the limits. */
  async run<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    const s = this.state(endpoint);
    if (s.inFlight >= this.limits.maxInFlight) {
      if (s.queue.length >= this.limits.maxQueue) {
        s.refused += 1;
        this.refused += 1;
        throw this.saturated(endpoint, s);
      }
      await new Promise<void>((admit, reject) => {
        const waiter: Waiter = {
          admit,
          refuse: reject,
          timer: setTimeout(() => {
            const i = s.queue.indexOf(waiter);
            if (i >= 0) s.queue.splice(i, 1);
            s.refused += 1;
            this.refused += 1;
            reject(this.saturated(endpoint, s));
          }, this.limits.queueTimeoutMs),
        };
        s.queue.push(waiter);
      });
      // The releasing call handed its slot over directly (inFlight unchanged).
    } else {
      s.inFlight += 1;
    }
    s.admitted += 1;
    this.admitted += 1;
    try {
      return await fn();
    } finally {
      const next = s.queue.shift();
      if (next) {
        clearTimeout(next.timer);
        next.admit();
      } else {
        s.inFlight -= 1;
      }
    }
  }

  snapshot(): GateSnapshot {
    const endpoints: Record<string, EndpointGateSnapshot> = {};
    for (const [url, s] of this.endpoints) {
      endpoints[url] = { inFlight: s.inFlight, queued: s.queue.length, admitted: s.admitted, refused: s.refused };
    }
    return { limits: { ...this.limits }, admitted: this.admitted, refused: this.refused, endpoints };
  }
}

// One gate per process. Next.js can evaluate a module more than once across
// its bundles, so the instance lives on globalThis, the way the scheduler
// singleton does.
const KEY = "__patterstage_gateway_gate__";

export function getDefaultGatewayGate(): GatewayGate {
  const g = globalThis as unknown as Record<string, GatewayGate | undefined>;
  if (!g[KEY]) g[KEY] = new GatewayGate(gateLimitsFromEnv(process.env));
  return g[KEY];
}
