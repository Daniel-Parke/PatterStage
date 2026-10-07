import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MissionRow } from "@/hooks/missions-page-types";
import { jsonResponse } from "./fetch-map";

export const LIST = "/api/missions?limit=200";
export const OLDER = "/api/missions?id=older";
export const missionRow = (id: string, name: string, prompt = `Instruction ${id}`): MissionRow =>
  ({ id, name, status: "dispatched", prompt, queuedForRun: false } as MissionRow);
export const detail = (row: MissionRow) => jsonResponse({ data: { mission: row, run: null, schedule: null } });
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

interface MissionLinkTransport {
  rows: () => MissionRow[];
  older: () => MissionRow;
  selectedB: () => MissionRow;
  intercept: (url: string) => Promise<Response> | undefined;
  writeError: (method: string, url: string) => string;
  readError: (url: string) => string;
}

// One fresh client and strict transport per case. Call logging precedes the
// interceptor, so a held first lookup keeps its original ordering semantics.
export function createMissionLinkQueryFixture(transport: MissionLinkTransport) {
  const savedFetch = global.fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const calls: string[] = [], unexpected: string[] = [];
  function Provider({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input);
    if (init?.method && init.method !== "GET") {
      unexpected.push(`${init.method} ${url}`);
      throw new Error(transport.writeError(init.method, url));
    }
    calls.push(url);
    const held = transport.intercept(url);
    if (held) return held;
    if (url === LIST) return jsonResponse({ data: { missions: transport.rows() } });
    if (url === OLDER) return detail(transport.older());
    if (url === "/api/missions?id=B") return detail(transport.selectedB());
    if (url === "/api/templates") return jsonResponse({ data: { templates: [] } });
    if (url === "/api/mission-categories") return jsonResponse({ data: { categories: [] } });
    unexpected.push(url);
    throw new Error(transport.readError(url));
  });
  const dispose = () => { client.clear(); global.fetch = savedFetch; };
  return { Provider, calls, unexpected, dispose };
}
