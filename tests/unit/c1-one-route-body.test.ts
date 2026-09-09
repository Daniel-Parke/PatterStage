/**
 * C1 · One route body.
 *
 * 120 of the 169 API handlers end in the same statement: a try whose catch
 * is one line, `return serverErrorFromCatch("GET /api/x", "doing y", error,
 * "Failed to y")`. Six lines and two indents per site to say "log it under
 * my name and answer 500 with this sentence". `route(name, doing, failed,
 * handler)` says it once: it runs the handler, and a throw anywhere in it,
 * the statements before the old try included, is logged under the route's
 * name and answered with the sentence. Nothing a handler returns is touched.
 *
 * The recon: org/reviews/2026-09-consolidation-recon.md §1. The census
 * measure `routesWithTryCatch` reads the shape; this suite reads the wrapper.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

const mockLogApiError = jest.fn();
jest.mock("@/lib/api-logger", () => ({
  ...(jest.requireActual("@/lib/api-logger") as Record<string, unknown>),
  logApiError: (...a: unknown[]) => mockLogApiError(...a),
}));

import { route } from "@/lib/api-route";

const ROOT = join(__dirname, "..", "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

describe("C1 · one route body", () => {
  beforeEach(() => mockLogApiError.mockClear());

  it("passes a handler's response through, with its arguments", async () => {
    const handler = jest.fn(async (req: { url: string }, ctx: { params: Promise<{ id: string }> }) => {
      const { id } = await ctx.params;
      return NextResponse.json({ url: req.url, id });
    });
    const GET = route("GET /api/things/[id]", "reading a thing", "Failed to read the thing", handler);
    const res = await GET({ url: "/api/things/7" }, { params: Promise.resolve({ id: "7" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "/api/things/7", id: "7" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockLogApiError).not.toHaveBeenCalled();
  });

  it("answers a throw with 500 and the sentence, logged under the route's name", async () => {
    const boom = new Error("the database is locked");
    const POST = route("POST /api/things", "creating a thing", "Failed to create the thing", async () => {
      throw boom;
    });
    const res = await POST();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to create the thing" });
    expect(mockLogApiError).toHaveBeenCalledWith("POST /api/things", "creating a thing", boom);
  });

  it("a synchronous throw is caught the same way", async () => {
    const DELETE = route("DELETE /api/things", "deleting", "Failed to delete", () => {
      throw new Error("sync");
    });
    const res = await DELETE();
    expect(res.status).toBe(500);
    expect(mockLogApiError).toHaveBeenCalledTimes(1);
  });

  it("no route ends in the one-line catch any more", () => {
    const offenders: string[] = [];
    for (const f of walk(join(ROOT, "src", "app", "api"))) {
      const src = readFileSync(f, "utf8");
      if (/catch \(error\) \{\s*return serverErrorFromCatch\(/.test(src)) offenders.push(f.slice(ROOT.length + 1));
    }
    expect(offenders).toEqual([]);
  });

  it("the converted routes are exported through the wrapper, and still by their method names", () => {
    let wrapped = 0;
    for (const f of walk(join(ROOT, "src", "app", "api"))) {
      const src = readFileSync(f, "utf8");
      wrapped += (src.match(/^export const (GET|POST|PUT|PATCH|DELETE) = route\(/gm) ?? []).length;
    }
    expect(wrapped).toBeGreaterThanOrEqual(100);
  });
});
