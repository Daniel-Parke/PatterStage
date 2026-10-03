import { NextResponse, type NextRequest } from "next/server";

/** Recheck a real Next browser caller when an awaited handler releases its response. */
export async function guardCompletedResponse(request: NextRequest | undefined, response: Response): Promise<Response> {
  // Production route handlers receive a NextRequest after the proxy's entry
  // check. Direct unit calls that bypass the proxy may supply a partial stub.
  if (!request || typeof request.headers?.get !== "function" || typeof request.cookies?.get !== "function") {
    return response;
  }
  const supplied = request.headers.get("authorization");
  const cookie = request.cookies.get("ps_session")?.value;
  if (!supplied && !cookie) return response;
  const { streamAuthorizer } = await import("@/lib/auth/stream-guard");
  if (streamAuthorizer(request)()) return response;
  return NextResponse.json({ error: "Browser session is no longer authorised." }, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Preserve a direct handler's error/status behaviour, checking at hand-off. */
export function guardRoute<Args extends unknown[], Result extends Response>(
  handler: (...args: Args) => Result | Promise<Result>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => guardCompletedResponse(args[0] as NextRequest | undefined, await handler(...args));
}
