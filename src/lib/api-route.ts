// ═══════════════════════════════════════════════════════════════
// route — one body for an API handler (C1, T-0136)
//
// 120 of the 169 handlers under src/app/api ended in the same statement: a
// try whose catch was one line, `return serverErrorFromCatch("GET /api/x",
// "doing y", error, "Failed to y")`. Six lines and two indents per site to
// say "log it under my name and answer 500 with this sentence". This says it
// once. A throw anywhere in the handler, the statements that used to sit
// before the try included, is logged under the route's name and answered
// with the sentence; a response the handler returns is passed through
// untouched, whatever its status. The API contract is unchanged: one call,
// one log line, one response (T-0005 and the api-logger's own note).
//
// The name is the log's key ("GET /api/models"), `doing` is what the log
// says was happening, `failed` is the sentence the client reads. A handler
// on a dynamic segment names the request in its log ("DELETE
// /api/artifacts/abc"), and that id is in the route's params; each of the
// three may therefore be a function of the resolved params, called only on
// the failure path, so the log keeps the id it always had. A catch that does
// more than log keeps its own try; the wrapper is for the shape that was the
// same a hundred times.
// ═══════════════════════════════════════════════════════════════

import type { NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";

type Params = Record<string, string>;
export type RouteText = string | ((params: Params) => string);
type Handler<Args extends unknown[]> = (...args: Args) => Promise<NextResponse | Response> | NextResponse | Response;

/** The route's params, resolved, from the second argument Next passes; `{}` when there are none. */
async function paramsOf(args: unknown[]): Promise<Params> {
  const ctx = args[1] as { params?: Params | Promise<Params> } | undefined;
  const p = ctx?.params;
  if (!p) return {};
  return (typeof (p as Promise<Params>).then === "function" ? await p : p) as Params;
}

const say = (text: RouteText, params: Params): string => (typeof text === "function" ? text(params) : text);

export function route<Args extends unknown[]>(
  name: RouteText,
  doing: RouteText,
  failed: RouteText,
  handler: Handler<Args>,
): (...args: Args) => Promise<NextResponse | Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const params = await paramsOf(args).catch(() => ({}) as Params);
      return serverErrorFromCatch(say(name, params), say(doing, params), error, say(failed, params));
    }
  };
}
