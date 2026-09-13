/** @jest-environment node */
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

import { getCorrelationId, requireSignedRequest } from "@/lib/api/api-auth";

describe("api-auth", () => {
  afterEach(() => {
    delete process.env.CH_REQUEST_SIGNING_SECRET;
    delete process.env.PS_REQUEST_SIGNING_SECRET;
  });

  // `requireAuth` used to be tested here. It was a thin alias for
  // requireNotReadOnly() that authenticated nothing, and T-0048 deleted it along
  // with all 108 call sites; the proxy refuses unsafe methods under read-only
  // before any handler runs. The behaviour this asserted is now covered
  // end-to-end in tests/unit/read-only-actually-reads.test.ts, for every route
  // rather than for a synthetic request.

  it("accepts valid signed request", () => {
    process.env.CH_REQUEST_SIGNING_SECRET = "secret";
    const ts = Date.now().toString();
    const payload = `POST:/api/update:${ts}`;
    const signature = createHmac("sha256", "secret").update(payload).digest("hex");
    const request = new NextRequest("http://localhost/api/update", {
      method: "POST",
      headers: { "x-ch-ts": ts, "x-ch-signature": signature },
    });
    expect(requireSignedRequest(request)).toBeNull();
  });

  it("rejects tampered signed request", () => {
    process.env.CH_REQUEST_SIGNING_SECRET = "secret";
    const ts = Date.now().toString();
    const request = new NextRequest("http://localhost/api/update", {
      method: "POST",
      headers: { "x-ch-ts": ts, "x-ch-signature": "bad-signature" },
    });
    expect(requireSignedRequest(request)?.status).toBe(401);
  });

  // The PS_ name and the x-ps-* headers are the ones the documentation gives,
  // and until now nothing tested them: every signing case above spells the
  // secret CH_REQUEST_SIGNING_SECRET and the headers x-ch-*. That mattered
  // because the CH_ spellings are the ones scheduled for removal, so the whole
  // signing surface would have gone untested the moment they went (critic-05c).

  const signed = (secret: string, ts: string, path = "/api/update") => {
    const payload = `POST:${path}:${ts}`;
    return createHmac("sha256", secret).update(payload).digest("hex");
  };

  const psRequest = (ts: string, signature: string) =>
    new NextRequest("http://localhost/api/update", {
      method: "POST",
      headers: { "x-ps-ts": ts, "x-ps-signature": signature },
    });

  it("accepts a request signed with PS_REQUEST_SIGNING_SECRET and x-ps-* headers", () => {
    process.env.PS_REQUEST_SIGNING_SECRET = "ps-secret";
    const ts = Date.now().toString();
    expect(requireSignedRequest(psRequest(ts, signed("ps-secret", ts)))).toBeNull();
  });

  it("rejects an x-ps-* request whose signature was tampered with", () => {
    process.env.PS_REQUEST_SIGNING_SECRET = "ps-secret";
    const ts = Date.now().toString();
    expect(requireSignedRequest(psRequest(ts, "bad-signature"))?.status).toBe(401);
  });

  it("rejects an x-ps-* request signed with the wrong secret", () => {
    process.env.PS_REQUEST_SIGNING_SECRET = "ps-secret";
    const ts = Date.now().toString();
    expect(requireSignedRequest(psRequest(ts, signed("not-the-secret", ts)))?.status).toBe(401);
  });

  it("rejects an x-ps-* request whose timestamp is outside the five-minute window", () => {
    process.env.PS_REQUEST_SIGNING_SECRET = "ps-secret";
    const ts = (Date.now() - 6 * 60 * 1000).toString();
    expect(requireSignedRequest(psRequest(ts, signed("ps-secret", ts)))?.status).toBe(401);
  });

  it("prefers PS_REQUEST_SIGNING_SECRET when both names are set", () => {
    // Both names are live through v1.0.0. A signature made with the PS_ secret
    // has to verify, or an install that set both would refuse its own caller.
    process.env.PS_REQUEST_SIGNING_SECRET = "ps-secret";
    process.env.CH_REQUEST_SIGNING_SECRET = "ch-secret";
    const ts = Date.now().toString();
    expect(requireSignedRequest(psRequest(ts, signed("ps-secret", ts)))).toBeNull();
    expect(requireSignedRequest(psRequest(ts, signed("ch-secret", ts)))?.status).toBe(401);
  });

  it("uses x-correlation-id before x-request-id", () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: { "x-correlation-id": "cid-1", "x-request-id": "rid-1" },
    });
    expect(getCorrelationId(request)).toBe("cid-1");
  });
});

// `requireNotReadOnly` was tested here, in five cases: null when writes are
// allowed, a 503 with the resource named when they are not, and the remedy
// sentence in both spellings. app-06 (ruled 2026-09-12) deleted the function.
//
// Eleven of its seventeen callers could not fire over HTTP — src/proxy.ts
// refuses every unsafe method under read-only before a handler runs — while
// sixty-nine other write handlers never called it at all. The six that stayed
// are the host-side routes, and they call `isReadOnly()` and
// `readOnlyMessage()` directly, which is what these cases were really about.
// `k5-the-ruled-security-fixes.test.ts` calls all six of those handlers
// directly under the mode and requires each resource-named sentence, and drives
// every route that lost its check through proxy() for the same sentence.
