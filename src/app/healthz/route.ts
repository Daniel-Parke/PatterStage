// Bare liveness probe — GET /healthz → 200 "ok"
// No auth, no DB, no version/config info. Public path in proxy.ts.
export function GET(): Response {
  return new Response("ok", {
    status: 200,
    headers: {
      "content-type": "text/plain",
      "cache-control": "no-store",
    },
  });
}
