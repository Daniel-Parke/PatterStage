// The AgentRuntime wire contract, asserted against the vendored fixture.
//
// ADR-0002 decision 3: "PatterStage adopts `agentruntime-wire.json` as a merge
// gate, closing the convergence gate from its own side without waiting for the
// other." ADR-0002 keeps the run engine here and makes the estate's shared
// asset the CONTRACT, not the implementation; PatterStudio's Python runtime
// implements the same shapes. This test is that gate on this side.
//
// tests/fixtures/agentruntime-wire.json is a byte-identical copy of
// PatterStudio's tests/fixtures/agentruntime-wire.json (sha256
// f0737ef1eea2a27576d357b4803867cdf00ebda417fe930bcc7678f74f68a61c). Vendored,
// not fetched: PatterStage is a public Apache-2.0 application and must not take
// any dependency, even a CI one, on a private repo. Refresh it by copying the
// file again, which makes the two copies trivially diffable.
//
// The fixture's own header states the direction of the contract: the TypeScript
// implementation is the reference and the Python side must match it case for
// case. So a Zod or mapping edit that changes what leaves this repo turns this
// file red rather than silently re-specifying the contract for both products.
//
// Everything below drives the PUBLIC port (HermesRuntime with an injected
// fetch), never a module-private helper. Pinning the exported seam is the point;
// a test of the internals would pass while the port's behaviour changed.

import { readFileSync } from "fs";
import { join } from "path";

import { HermesRuntime } from "@/lib/runtime/HermesRuntime";
import type { RuntimeEndpoint } from "@/lib/runtime/endpoint-registry";
import type { RunEvent, RunHandle, RunResult, RunUsage } from "@/lib/runtime/types";

// ── The fixture ──────────────────────────────────────────────

interface StatusCase {
  wire: string | null;
  expect: string;
}
interface UsageCase {
  wire: unknown;
  expect: Record<string, number> | null;
}
interface RunResultCase {
  name: string;
  run_id_param: string;
  wire: Record<string, unknown>;
  expect: Record<string, unknown>;
}
interface SubmitCase {
  name: string;
  wire: Record<string, unknown>;
  expect: Record<string, unknown>;
}
interface SseCase {
  name: string;
  block: string;
  expect: { type: string; data?: unknown } | null;
}
interface WireFixture {
  description: string;
  status_normalisation: StatusCase[];
  usage_mapping: UsageCase[];
  run_result_mapping: RunResultCase[];
  submit_mapping: SubmitCase[];
  sse_events: SseCase[];
}

const FIXTURE_PATH = join(__dirname, "..", "fixtures", "agentruntime-wire.json");
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as WireFixture;

// ── Transport doubles ────────────────────────────────────────

const endpoint: RuntimeEndpoint = {
  profileName: "default",
  baseUrl: "http://gw.test:8642",
  apiKey: "secret-key",
};

function runtimeReturning(body: unknown): HermesRuntime {
  const fetchImpl = (async () =>
    ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response) as typeof fetch;
  return new HermesRuntime({ fetchImpl, resolve: () => endpoint });
}

function runtimeStreaming(chunk: string): HermesRuntime {
  const enc = new TextEncoder();
  let sent = false;
  const fetchImpl = (async () =>
    ({
      ok: true,
      status: 200,
      statusText: "OK",
      body: {
        getReader: () => ({
          read: async () => {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: enc.encode(chunk) };
          },
        }),
      },
    }) as unknown as Response) as typeof fetch;
  return new HermesRuntime({ fetchImpl, resolve: () => endpoint });
}

// ── camelCase DTO → the fixture's wire-style snake_case ──────
//
// The fixture records expectations in wire vocabulary because Python reads the
// same file. Translating here, rather than editing the fixture, is what keeps
// the two copies byte-identical and therefore diffable.

function usageToWire(u: RunUsage | undefined): Record<string, number> | null {
  if (!u) return null;
  return {
    input_tokens: u.inputTokens,
    output_tokens: u.outputTokens,
    total_tokens: u.totalTokens,
  };
}

function runResultToWire(r: RunResult): Record<string, unknown> {
  return {
    run_id: r.runId,
    status: r.status,
    session_id: r.sessionId ?? null,
    output: r.output ?? null,
    usage: usageToWire(r.usage),
    error: r.error ?? null,
  };
}

function runHandleToWire(h: RunHandle): Record<string, unknown> {
  return {
    run_id: h.runId,
    status: h.status,
    session_id: h.sessionId ?? null,
  };
}

/** Compare only the keys the fixture case asserts, so it can stay terse. */
function pick(
  actual: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = actual[k];
  return out;
}

async function collectEvents(chunk: string): Promise<RunEvent[]> {
  const events: RunEvent[] = [];
  for await (const e of runtimeStreaming(chunk).streamRunEvents("run_1")) {
    events.push(e);
  }
  return events;
}

// ── The gate ─────────────────────────────────────────────────

describe("AgentRuntime wire contract (tests/fixtures/agentruntime-wire.json)", () => {
  it("the vendored fixture carries every section the gate asserts", () => {
    expect(fixture.status_normalisation.length).toBeGreaterThan(0);
    expect(fixture.usage_mapping.length).toBeGreaterThan(0);
    expect(fixture.run_result_mapping.length).toBeGreaterThan(0);
    expect(fixture.submit_mapping.length).toBeGreaterThan(0);
    expect(fixture.sse_events.length).toBeGreaterThan(0);
  });

  describe("status normalisation", () => {
    for (const c of fixture.status_normalisation) {
      it(`getRun maps ${JSON.stringify(c.wire)} to ${c.expect}`, async () => {
        const r = await runtimeReturning({ run_id: "r", status: c.wire }).getRun("r");
        expect(r.status).toBe(c.expect);
      });
    }
  });

  describe("usage mapping", () => {
    for (const c of fixture.usage_mapping) {
      it(`getRun maps usage ${JSON.stringify(c.wire)}`, async () => {
        const r = await runtimeReturning({
          run_id: "r",
          status: "completed",
          usage: c.wire,
        }).getRun("r");
        expect(usageToWire(r.usage)).toEqual(c.expect);
      });
    }
  });

  describe("run result mapping", () => {
    for (const c of fixture.run_result_mapping) {
      it(c.name, async () => {
        const r = await runtimeReturning(c.wire).getRun(c.run_id_param);
        expect(pick(runResultToWire(r), Object.keys(c.expect))).toEqual(c.expect);
      });
    }
  });

  describe("submit mapping", () => {
    for (const c of fixture.submit_mapping) {
      it(c.name, async () => {
        const h = await runtimeReturning(c.wire).submitRun({
          input: "do it",
          idempotencyKey: "ps-run-1",
        });
        expect(pick(runHandleToWire(h), Object.keys(c.expect))).toEqual(c.expect);
      });
    }
  });

  describe("SSE events", () => {
    for (const c of fixture.sse_events) {
      it(c.name, async () => {
        // The adapter splits the stream on a blank line, so each recorded block
        // is fed as one complete SSE frame.
        const events = await collectEvents(`${c.block}\n\n`);
        if (c.expect === null) {
          expect(events).toEqual([]);
          return;
        }
        expect(events).toHaveLength(1);
        expect(pick(events[0] as unknown as Record<string, unknown>, Object.keys(c.expect))).toEqual(
          c.expect,
        );
      });
    }
  });
});
