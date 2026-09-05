/** @jest-environment node */
/**
 * B1 (T-0095), D128 and D127.
 *
 * D128. Two implementations of "cancel a mission": the action handler behind
 * POST /api/missions { action: "cancel" } finalises synchronously and stops the
 * backend in the background, answering `{ mission, cancel }`; the REST route
 * POST /api/missions/[id]/cancel awaited `cancelMissionRun`, which stops the
 * backend FIRST and answers `{ cancelled: true }`. Same click, two orders, two
 * envelopes. The REST route now delegates to the handler and the second
 * implementation is gone.
 *
 * D127. GET /api/runs/[id]/events proxied the backend's SSE stream and ignored
 * the request's abort signal, so a browser that navigated away left the
 * upstream stream open until the run ended. The route now hands the runtime a
 * signal, and pulls it when the client goes.
 */
import { readFileSync } from "fs";
import { join } from "path";

const mockHandleCancel = jest.fn();
jest.mock("@/lib/missions/mission-handlers/cancel", () => ({
  handleCancelMission: (body: unknown) => mockHandleCancel(body),
}));
jest.mock("@/lib/missions/mission-repository", () => ({
  getMission: jest.fn((_id: string) => ({ id: "m1" })),
}));
jest.mock("@/lib/orchestration", () => ({
  cancelMissionRun: jest.fn(),
  stopBackendRunForMission: jest.fn(),
}));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));

const mockGetRun = jest.fn((_id: string) => ({ id: "r1", runId: "backend-1", profileName: null }));
jest.mock("@/lib/runs-repository", () => ({ getRun: (id: string) => mockGetRun(id) }));

let receivedSignal: AbortSignal | undefined;
jest.mock("@/lib/runtime", () => ({
  runtime: {
    streamRunEvents: async function* (_id: string, _profile?: string, signal?: AbortSignal) {
      receivedSignal = signal;
      yield { type: "message.delta", data: { delta: "hi" } };
      await new Promise<void>((resolve) => {
        if (!signal) return; // never resolves: the old behaviour, a stream nobody can stop
        if (signal.aborted) resolve();
        else signal.addEventListener("abort", () => resolve(), { once: true });
      });
    },
  },
}));

import { NextRequest, NextResponse } from "next/server";

import { HermesRuntime } from "@/lib/runtime/HermesRuntime";
import type { RuntimeEndpoint } from "@/lib/runtime/endpoint-registry";

const ROOT = join(__dirname, "..", "..");

describe("one cancel", () => {
  it("POST /api/missions/[id]/cancel is the action handler under another URL", async () => {
    mockHandleCancel.mockReturnValue(
      NextResponse.json({
        data: { mission: { id: "m1", status: "failed" }, cancel: { accepted: true, processKillPending: true } },
      }),
    );
    const { POST } = await import("@/app/api/missions/[id]/cancel/route");
    const res = await POST(new NextRequest("http://localhost/api/missions/m1/cancel", { method: "POST" }), {
      params: Promise.resolve({ id: "m1" }),
    });
    expect(mockHandleCancel).toHaveBeenCalledWith({ id: "m1" });
    const body = (await res.json()) as { data: { cancel: { accepted: boolean } } };
    expect(body.data.cancel.accepted).toBe(true);
  });

  it("the second implementation is gone from the orchestration layer", () => {
    const dispatch = readFileSync(join(ROOT, "src", "lib", "orchestration", "dispatch.ts"), "utf-8");
    expect(dispatch).not.toMatch(/export async function cancelMissionRun/);
    const index = readFileSync(join(ROOT, "src", "lib", "orchestration", "index.ts"), "utf-8");
    expect(index).not.toMatch(/cancelMissionRun/);
  });
});

describe("a stream that lets go", () => {
  it("hands the runtime an abort signal and pulls it when the client cancels", async () => {
    receivedSignal = undefined;
    const { GET } = await import("@/app/api/runs/[id]/events/route");
    const res = await GET(new NextRequest("http://localhost/api/runs/r1/events"), {
      params: Promise.resolve({ id: "r1" }),
    });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    await reader.read(); // the route's own `open` frame
    await reader.read(); // the backend's first event, so the generator has started
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal!.aborted).toBe(false);

    await expect(reader.cancel()).resolves.toBeUndefined();

    expect(receivedSignal!.aborted).toBe(true);
  });

  it("HermesRuntime forwards the caller's signal to fetch", async () => {
    const endpoint: RuntimeEndpoint = { profileName: "default", baseUrl: "http://gw.test:8642", apiKey: null };
    const seen: RequestInit[] = [];
    const enc = new TextEncoder();
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init ?? {});
      let sent = false;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        body: {
          getReader: () => ({
            read: async () =>
              sent
                ? { done: true, value: undefined }
                : ((sent = true), { done: false, value: enc.encode('data: {"event":"x"}\n\n') }),
          }),
        },
      } as unknown as Response;
    }) as typeof fetch;
    const rt = new HermesRuntime({ fetchImpl, resolve: () => endpoint });
    const ac = new AbortController();
    for await (const e of rt.streamRunEvents("run_1", undefined, ac.signal)) void e;
    expect(seen[0].signal).toBe(ac.signal);
  });
});
