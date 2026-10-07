/** Bare liveness probe for load balancers and uptime monitors. */
export function GET(): Response {
  return new Response("ok", {
    status: 200,
    headers: {
      "content-type": "text/plain",
      "cache-control": "no-store",
    },
  });
}
