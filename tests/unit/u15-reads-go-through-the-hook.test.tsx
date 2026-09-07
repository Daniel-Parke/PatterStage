/** @jest-environment jsdom */
/**
 * U15 · Reads go through the hook.
 *
 * Two data layers coexisted: useApiResource on react-query, cached and
 * deduped, and raw safeApiCall inside useEffect, neither. The dashboard paid
 * for it on every load: 22 requests, four endpoints fetched twice, because
 * the same endpoint was cached under different keys (["dashboard","subsystems"]
 * here, ["status-subsystems"] there) and a second loader fetched three of the
 * live queries' endpoints again for a static bundle.
 *
 * The fix is by construction, not by discipline. useApiResource takes the
 * ENDPOINT and derives the key from it, so two readers of one endpoint are one
 * cache entry whatever they select; the cache holds the envelope and each
 * reader selects its own shape from it. A read that must POST (the story
 * routes' action envelope) keys on endpoint and body. And react-query is
 * reached only through this hook: no component or hook calls useQuery itself,
 * and no component reads the API inside a useEffect.
 */

import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

jest.mock("@/lib/api-fetch", () => ({ safeApiCall: jest.fn() }));

import { apiQueryKey, useApiResource } from "@/hooks/useApiResource";
import { safeApiCall } from "@/lib/api-fetch";

const mockSafeApiCall = safeApiCall as jest.Mock;
const ROOT = join(__dirname, "..", "..");

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

beforeEach(() => jest.clearAllMocks());

describe("U15 · the key is the endpoint", () => {
  it("two readers of one endpoint share one request and keep their own shapes", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: { stats: { total: 7 }, note: "seven" } } });
    const { result } = renderHook(
      () => ({
        total: useApiResource<number>("/api/stats", {
          select: (p) => (p as { stats?: { total: number } } | null)?.stats?.total,
        }),
        note: useApiResource<string>("/api/stats", {
          select: (p) => (p as { note?: string } | null)?.note,
        }),
      }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.total.data).toBe(7));
    await waitFor(() => expect(result.current.note.data).toBe("seven"));
    expect(mockSafeApiCall).toHaveBeenCalledTimes(1);
    expect(mockSafeApiCall).toHaveBeenCalledWith("/api/stats");
  });

  it("a read that must POST keys on its body and is sent as one", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: { stories: [{ id: "s1" }] } } });
    const { result } = renderHook(
      () =>
        useApiResource<Array<{ id: string }>>("/api/stories", {
          body: { action: "list" },
          select: (p) => (p as { stories?: Array<{ id: string }> } | null)?.stories,
        }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.data).toEqual([{ id: "s1" }]));
    expect(mockSafeApiCall).toHaveBeenCalledWith("/api/stories", { method: "POST", body: { action: "list" } });
  });

  it("names the key the way the cache will, for whoever invalidates it", () => {
    expect(apiQueryKey("/api/prefs")).toEqual(["/api/prefs"]);
    expect(apiQueryKey("/api/stories", { action: "list" })).toEqual(["/api/stories", { action: "list" }]);
  });
});

describe("U15 · react-query is reached only through the hook", () => {
  const src = walk(join(ROOT, "src"));

  it("no component or hook calls useQuery itself", () => {
    const offenders = src
      .filter((f) => rel(f) !== "src/hooks/useApiResource.ts")
      .filter((f) => /\buseQuery\s*[<(]/.test(readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("no one invalidates by a hand-written key", () => {
    const offenders: string[] = [];
    for (const f of src) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/invalidateQueries\(\s*\{\s*queryKey\s*:\s*\[/.test(line)) offenders.push(`${rel(f)}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it("the second dashboard loader is gone and the board reads through the hook", () => {
    expect(existsSync(join(ROOT, "src", "lib", "dashboard", "dashboard-initial-load.ts"))).toBe(false);
    const hook = readFileSync(join(ROOT, "src", "hooks", "useDashboard.ts"), "utf8");
    expect(hook).not.toMatch(/loadInitialDashboardData/);
    expect(hook).toMatch(/useApiResource/);
  });

  /**
   * A read lexically inside a useEffect body: the call, or the async function
   * it sits in, opened after `useEffect(` and before its matching close. This
   * is the pattern that fetched on mount and on every poll with no cache in
   * front of it; a read in a click handler is on demand and is not this.
   */
  function mountReads(file: string): string[] {
    const text = readFileSync(file, "utf8");
    const found: string[] = [];
    const re = /\buseEffect\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      let depth = 0;
      let i = m.index + m[0].length - 1;
      let end = -1;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (ch === "(") depth += 1;
        else if (ch === ")") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) continue;
      const body = text.slice(m.index, end);
      const read = body.match(/\b(safeApiCall|safeApiCallData|apiFetch)\s*[<(][^\n]*\n(?:[^\n]*\n){0,7}/g) ?? [];
      for (const call of read) {
        if (/\bmethod\s*:/.test(call)) continue;
        const line = text.slice(0, text.indexOf(call)).split("\n").length;
        found.push(`${rel(file)}:${line}`);
      }
    }
    return found;
  }

  it("no component reads the API inside a useEffect", () => {
    const components = [...walk(join(ROOT, "src", "app")), ...walk(join(ROOT, "src", "components")), ...walk(join(ROOT, "src", "modules"))]
      .filter((f) => !/\/src\/app\/api\//.test(f.replace(/\\/g, "/")))
      .filter((f) => f.endsWith(".tsx"));
    const offenders = components.flatMap(mountReads);
    expect(offenders).toEqual([]);
  });
});
