// ═══════════════════════════════════════════════════════════════
// runtime/HermesRuntime.ts — AgentRuntime over the Hermes API Server
//
// Typed HTTP client for the Hermes API Server (:8642). Replaces the old
// CLI-subprocess + bash/PID/status-file backend (the since-deleted
// src/lib/backends/hermes.ts, named here for git archaeology, not to be found):
// runs are submitted/polled/stopped over HTTP, so there is no bash, no signal
// handling, and no filesystem IPC. `fetchImpl` and endpoint resolution are
// injectable for unit testing without a live gateway or DB.
// ═══════════════════════════════════════════════════════════════

import { GatewayGate, getDefaultGatewayGate, type GateSnapshot } from "./gateway-gate";
import {
  type AgentRuntime,
  type RunSubmit,
  type RunHandle,
  type RunResult,
  type RunUsage,
  type RunStatus,
  type RunEvent,
  type ApprovalDecision,
  type HealthReport,
  type Capabilities,
  type ModelInfo,
  type SkillInfo,
  type ToolsetInfo,
  type SessionCreate,
  type SessionInfo,
  RuntimeRequestError,
} from "./types";
import {
  resolveEndpoint as defaultResolveEndpoint,
  type RuntimeEndpoint,
} from "./endpoint-registry";
import { describeGatewayFailure } from "./gateway-error";
import { normaliseUsage } from "@/lib/usage-shape";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Sleep that rejects the moment `signal` aborts, instead of finishing the wait
 * first. A plain `setTimeout` promise would make a cancelled mission sit out the
 * remaining backoff before noticing.
 */
function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(signal!.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface HermesRuntimeOptions {
  /** Override fetch (tests inject a mock). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Override the admission gate (tests inject a small one). Defaults to the process-wide gate. */
  gate?: GatewayGate;
  /** Override endpoint resolution (tests inject a fixed endpoint). */
  resolve?: (profile?: string) => RuntimeEndpoint;
  /** Per-request timeout for non-streaming calls. */
  timeoutMs?: number;
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  sessionId?: string;
  sessionKey?: string;
  signal?: AbortSignal;
}

// ── Mapping helpers (Hermes wire shapes -> canonical DTOs) ────

function normalizeRunStatus(s?: string): RunStatus {
  switch ((s ?? "").toLowerCase()) {
    case "completed":
    case "succeeded":
    case "success":
      return "completed";
    case "failed":
    case "error":
      return "failed";
    case "cancelled":
    case "canceled":
    case "stopped":
      return "cancelled";
    default:
      // started | running | in_progress | queued | pending | unknown
      return "started";
  }
}

/**
 * This was the first of what became four private conversions of the same three
 * numbers, and the only one that handled both wire vocabularies. It now defers
 * to the shared normaliser (T-0068) and keeps only the rename into RunUsage's
 * input/output naming, which is this layer's own vocabulary rather than a
 * provider's.
 */
function mapUsage(u: unknown): RunUsage | undefined {
  const n = normaliseUsage(u);
  return n
    ? { inputTokens: n.promptTokens, outputTokens: n.completionTokens, totalTokens: n.totalTokens }
    : undefined;
}

interface HermesRunDto {
  run_id?: string;
  id?: string;
  status?: string;
  session_id?: string;
  output?: unknown;
  usage?: unknown;
  error?: unknown;
}

function mapRunResult(runId: string, dto: HermesRunDto): RunResult {
  return {
    runId: dto.run_id ?? runId,
    status: normalizeRunStatus(dto.status),
    sessionId: dto.session_id,
    output: typeof dto.output === "string" ? dto.output : undefined,
    usage: mapUsage(dto.usage),
    error: typeof dto.error === "string" ? dto.error : undefined,
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

/**
 * Parse one SSE event block into a RunEvent. Real Hermes emits `data:`-only
 * lines and carries the event name *inside* the JSON as `event` (e.g.
 * "message.delta", "reasoning.available", "run.completed") — verified against
 * Hermes 0.16. We therefore key the type off the SSE `event:` field if present,
 * else `data.event`, else `data.type`.
 */
export function parseSseEvent(block: string): RunEvent | null {
  let eventName = "";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0 && !eventName) return null;
  const dataRaw = dataLines.join("\n");
  let data: unknown = dataRaw;
  if (dataRaw) {
    try {
      data = JSON.parse(dataRaw);
    } catch {
      data = dataRaw;
    }
  }
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const type =
    eventName ||
    (obj && typeof obj.event === "string" ? obj.event : "") ||
    (obj && typeof obj.type === "string" ? obj.type : "") ||
    "message";
  return { type, data };
}

// ── HermesRuntime ────────────────────────────────────────────

export class HermesRuntime implements AgentRuntime {
  private readonly fetchImpl: typeof fetch;
  private readonly gate: GatewayGate;
  private readonly resolve: (profile?: string) => RuntimeEndpoint;
  private readonly timeoutMs: number;

  constructor(opts: HermesRuntimeOptions = {}) {
    // Resolve fetch lazily at call time. Binding globalThis.fetch in the
    // constructor crashes at module load in environments without a global
    // fetch (e.g. the jsdom test runtime); deferring keeps construction safe.
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.gate = opts.gate ?? getDefaultGatewayGate();
    this.resolve = opts.resolve ?? defaultResolveEndpoint;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private buildHeaders(ep: RuntimeEndpoint, opts: RequestOpts): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (ep.apiKey) h["Authorization"] = `Bearer ${ep.apiKey}`;
    if (opts.idempotencyKey) h["Idempotency-Key"] = opts.idempotencyKey;
    if (opts.sessionId) h["X-Hermes-Session-Id"] = opts.sessionId;
    if (opts.sessionKey) h["X-Hermes-Session-Key"] = opts.sessionKey;
    return h;
  }

  private async fetchJson<T>(
    profile: string | undefined,
    path: string,
    opts: RequestOpts = {},
  ): Promise<T> {
    const ep = this.resolve(profile);
    // Every request/response call passes the endpoint's admission gate
    // (T-0090). Saturation refuses with a 503 that names the gate; streams
    // (streamRunEvents) do not come through here and hold no slot.
    return this.gate.run(ep.baseUrl, async () => {
      let res: Response;
      try {
        res = await this.fetchImpl(`${ep.baseUrl}${path}`, {
          method: opts.method ?? "GET",
          headers: this.buildHeaders(ep, opts),
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: opts.signal ?? AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        // One of the two places in the product where a raw fetch to the gateway
        // happens, and the only place where `ep.baseUrl` is known. Everything
        // downstream reads this through `messageFromError`, so translating here
        // fixes all seven storage columns at once (T-0080).
        throw (
          describeGatewayFailure(err, {
            baseUrl: ep.baseUrl,
            // The deadline only applies when it is OURS. A caller that brought
            // its own signal owns the timing, and naming our 30s would be a lie.
            timeoutMs: opts.signal ? undefined : this.timeoutMs,
            callerSignal: opts.signal,
          }) ?? err
        );
      }
      if (!res.ok) {
        const detail = await safeText(res);
        throw new RuntimeRequestError(
          `${opts.method ?? "GET"} ${path} → ${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`,
          res.status,
        );
      }
      return (await res.json()) as T;
    });
  }

  /** The gate's counters, for the subsystem health summary (T-0091). */
  gateSnapshot(): GateSnapshot {
    return this.gate.snapshot();
  }

  /**
   * POST /v1/runs, retrying only on 429.
   *
   * Linear backoff (2s, 4s, 6s) over 4 attempts, so the worst case adds 12s
   * before surfacing the 429 to the caller. Deliberately linear and short: a
   * long exponential budget would let a queued mission sit past the point where
   * the operator would rather see the error.
   *
   * Aborts immediately if the caller's signal fires, including mid-sleep, so a
   * cancelled mission does not keep waiting on a gateway it no longer needs.
   * Any non-429 error propagates on the first attempt: a 400 or a 500 will not
   * become a 200 by asking again.
   */
  private async submitWithBackoff(
    input: RunSubmit,
    body: Record<string, unknown>,
  ): Promise<HermesRunDto> {
    const MAX_ATTEMPTS = 4;
    for (let attempt = 0; ; attempt++) {
      input.signal?.throwIfAborted();
      try {
        return await this.fetchJson<HermesRunDto>(input.profileName, "/v1/runs", {
          method: "POST",
          body,
          idempotencyKey: input.idempotencyKey,
          sessionId: input.sessionId,
          sessionKey: input.sessionKey,
          signal: input.signal,
        });
      } catch (err) {
        const busy = err instanceof RuntimeRequestError && err.status === 429;
        if (!busy || attempt >= MAX_ATTEMPTS - 1) throw err;
        await sleepAbortable(2000 * (attempt + 1), input.signal);
      }
    }
  }

  async submitRun(input: RunSubmit): Promise<RunHandle> {
    const body: Record<string, unknown> = { input: input.input };
    if (input.instructions) body.instructions = input.instructions;
    if (input.sessionId) body.session_id = input.sessionId;
    if (input.previousResponseId) body.previous_response_id = input.previousResponseId;

    // A gateway at its concurrency cap answers 429, which is "come back", not
    // "this failed". Every caller was treating it as failure: composer/dispatch
    // wrote the node-run failed, which the engine routes as on_fail and which
    // burns one of MAX_NODE_ATTEMPTS, so a busy gateway was indistinguishable
    // from a stage that produced a bad verdict. orchestration/dispatch failed
    // the mission and closed its session outright. Only the benchmark runner
    // retried, because a harness cannot tolerate a false zero -- and it is the
    // one caller nobody has ever run.
    //
    // Retrying here is safe precisely because submitRun is idempotent: the
    // Idempotency-Key is PatterStage's own run id, so a coalesced duplicate is
    // already the documented contract of this method.
    const json = await this.submitWithBackoff(input, body);
    const runId = json.run_id ?? json.id;
    if (!runId) {
      throw new RuntimeRequestError("submitRun: gateway returned no run_id", 502);
    }
    return { runId, status: normalizeRunStatus(json.status), sessionId: json.session_id };
  }

  async getRun(runId: string, profile?: string): Promise<RunResult> {
    const json = await this.fetchJson<HermesRunDto>(
      profile,
      `/v1/runs/${encodeURIComponent(runId)}`,
    );
    return mapRunResult(runId, json);
  }

  async *streamRunEvents(
    runId: string,
    profile?: string,
    signal?: AbortSignal,
  ): AsyncIterable<RunEvent> {
    const ep = this.resolve(profile);
    let res: Response;
    try {
      res = await this.fetchImpl(
        `${ep.baseUrl}/v1/runs/${encodeURIComponent(runId)}/events`,
        {
          headers: { ...this.buildHeaders(ep, {}), Accept: "text/event-stream" },
          // No timeout: this is a long-lived stream. UX-only — getRun() polling
          // remains the authoritative source of run state. The caller's signal
          // is the one way it ends early (T-0095, D127).
          signal,
        },
      );
    } catch (err) {
      // The second raw fetch, and the one behind the live chat spinner. No
      // timeout applies here by design, so none is claimed.
      throw describeGatewayFailure(err, { baseUrl: ep.baseUrl }) ?? err;
    }
    if (!res.ok || !res.body) {
      throw new RuntimeRequestError(
        `stream /v1/runs/${runId}/events → ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const evt = parseSseEvent(block);
        if (evt) yield evt;
      }
    }
  }

  async stopRun(runId: string, profile?: string): Promise<void> {
    try {
      await this.fetchJson<unknown>(profile, `/v1/runs/${encodeURIComponent(runId)}/stop`, {
        method: "POST",
      });
    } catch (err) {
      // "Ensure it is not running" is the semantic. A run the gateway no
      // longer knows is not running: three cancel sites logged this 404 as an
      // ERROR for what was a success (T-0089).
      if (err instanceof RuntimeRequestError && err.status === 404) return;
      throw err;
    }
  }

  async resolveApproval(
    runId: string,
    decision: ApprovalDecision,
    profile?: string,
  ): Promise<void> {
    await this.fetchJson<unknown>(
      profile,
      `/v1/runs/${encodeURIComponent(runId)}/approval`,
      { method: "POST", body: { approved: decision.approved, note: decision.note } },
    );
  }

  async health(profile?: string): Promise<HealthReport> {
    for (const path of ["/health/detailed", "/health"]) {
      try {
        const json = await this.fetchJson<Record<string, unknown>>(profile, path);
        return { ok: true, detail: json };
      } catch {
        // try next path
      }
    }
    return { ok: false };
  }

  async capabilities(profile?: string): Promise<Capabilities> {
    const json = await this.fetchJson<Record<string, unknown>>(profile, "/v1/capabilities");
    const features =
      json.features && typeof json.features === "object"
        ? (json.features as Record<string, boolean>)
        : {};
    return { features, raw: json };
  }

  async listModels(profile?: string): Promise<ModelInfo[]> {
    const json = await this.fetchJson<unknown>(profile, "/v1/models");
    const arr = Array.isArray(json)
      ? json
      : Array.isArray((json as { data?: unknown[] })?.data)
        ? (json as { data: unknown[] }).data
        : [];
    return arr
      .map((m): ModelInfo | null => {
        if (!m || typeof m !== "object") return null;
        const o = m as Record<string, unknown>;
        const id = String(o.id ?? o.name ?? "");
        if (!id) return null;
        return { id, label: typeof o.name === "string" ? o.name : undefined };
      })
      .filter((m): m is ModelInfo => m !== null);
  }

  async listSkills(profile?: string): Promise<SkillInfo[]> {
    const json = await this.fetchJson<unknown>(profile, "/v1/skills");
    // Real Hermes returns { object: "list", data: [...] }.
    const arr = Array.isArray(json)
      ? json
      : Array.isArray((json as { data?: unknown[] })?.data)
        ? (json as { data: unknown[] }).data
        : [];
    return arr
      .map((s): SkillInfo | null => {
        if (!s || typeof s !== "object") return null;
        const o = s as Record<string, unknown>;
        const name = String(o.name ?? "");
        if (!name) return null;
        return {
          name,
          description: typeof o.description === "string" ? o.description : undefined,
          category: typeof o.category === "string" ? o.category : undefined,
        };
      })
      .filter((s): s is SkillInfo => s !== null);
  }

  async listToolsets(profile?: string): Promise<ToolsetInfo[]> {
    const json = await this.fetchJson<unknown>(profile, "/v1/toolsets");
    // Real Hermes returns { object: "list", platform, data: [...] }.
    const arr = Array.isArray(json)
      ? json
      : Array.isArray((json as { data?: unknown[] })?.data)
        ? (json as { data: unknown[] }).data
        : Array.isArray((json as { toolsets?: unknown[] })?.toolsets)
          ? (json as { toolsets: unknown[] }).toolsets
          : [];
    return arr
      .map((t): ToolsetInfo | null => {
        if (!t || typeof t !== "object") return null;
        const o = t as Record<string, unknown>;
        const name = String(o.name ?? "");
        if (!name) return null;
        const tools = Array.isArray(o.tools) ? o.tools.map((x) => String(x)) : [];
        return { name, tools };
      })
      .filter((t): t is ToolsetInfo => t !== null);
  }

  async createSession(input: SessionCreate, profile?: string): Promise<SessionInfo> {
    const json = await this.fetchJson<Record<string, unknown>>(profile, "/api/sessions", {
      method: "POST",
      body: { title: input.title, source: input.source },
    });
    // Real Hermes nests the record under `session`: { object, session: {...} }.
    const s =
      json.session && typeof json.session === "object"
        ? (json.session as Record<string, unknown>)
        : json;
    return {
      id: String(s.id ?? ""),
      title: typeof s.title === "string" ? s.title : undefined,
      source: typeof s.source === "string" ? s.source : undefined,
    };
  }
}
