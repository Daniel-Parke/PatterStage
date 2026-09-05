/** @jest-environment node */
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

import {
  getCorrelationId,
  requireNotReadOnly,
  requireSignedRequest,
} from "@/lib/api-auth";

describe("api-auth", () => {
  afterEach(() => {
    delete process.env.CH_REQUEST_SIGNING_SECRET;
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

  it("uses x-correlation-id before x-request-id", () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: { "x-correlation-id": "cid-1", "x-request-id": "rid-1" },
    });
    expect(getCorrelationId(request)).toBe("cid-1");
  });
});

describe("requireNotReadOnly", () => {
  const ORIGINAL_READ_ONLY = process.env.CH_READ_ONLY;
  afterEach(() => {
    if (ORIGINAL_READ_ONLY === undefined) delete process.env.CH_READ_ONLY;
    else process.env.CH_READ_ONLY = ORIGINAL_READ_ONLY;
  });

  it("returns null when not read-only (no context)", () => {
    delete process.env.CH_READ_ONLY;
    expect(requireNotReadOnly()).toBeNull();
  });

  it("returns null when not read-only (with context)", () => {
    delete process.env.CH_READ_ONLY;
    expect(requireNotReadOnly("skill writes are disabled")).toBeNull();
  });

  // The remedy in these three used to read "set PS_READ_ONLY=true to allow
  // writes", which is the OPPOSITE of the fix: setting it is what causes the
  // refusal. It survived because the proxy short-circuits first, so the wording
  // was nearly unreachable. Corrected in place with the reason, not deleted:
  // the thing being asserted (one 503, with a remedy the operator can act on)
  // is still the thing being asserted. T-0048.
  it("returns 503 with the canonical message when read-only and no context", async () => {
    process.env.CH_READ_ONLY = "true";
    const res = requireNotReadOnly();
    expect(res).not.toBeNull();
    expect(res?.status).toBe(503);
    const body = await res?.json();
    expect(body.error).toBe("PatterStage is in read-only mode (unset PS_READ_ONLY to allow writes).");
  });

  it("names the resource when a context is given, and still gives the remedy", async () => {
    process.env.CH_READ_ONLY = "true";
    const res = requireNotReadOnly("skill toggles are disabled");
    expect(res?.status).toBe(503);
    const body = await res?.json();
    expect(body.error).toBe(
      "PatterStage is in read-only mode: skill toggles are disabled (unset PS_READ_ONLY to allow writes).",
    );
  });

  it("treats empty string as no context (canonical default)", async () => {
    process.env.CH_READ_ONLY = "true";
    const res = requireNotReadOnly("");
    expect(res?.status).toBe(503);
    const body = await res?.json();
    expect(body.error).toBe("PatterStage is in read-only mode (unset PS_READ_ONLY to allow writes).");
  });
});
