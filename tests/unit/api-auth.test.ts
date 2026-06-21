/** @jest-environment node */
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

import {
  getCorrelationId,
  requireAuth,
  requireNotReadOnly,
  requireSignedRequest,
} from "@/lib/api-auth";

describe("api-auth", () => {
  afterEach(() => {
    delete process.env.CH_REQUEST_SIGNING_SECRET;
  });

  it("allows writes when not read-only", () => {
    delete process.env.CH_READ_ONLY;
    const request = new NextRequest("http://localhost/api/test", { method: "POST" });
    expect(requireAuth(request)).toBeNull();
  });

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

  it("returns 503 with canonical default message when read-only and no context", async () => {
    process.env.CH_READ_ONLY = "true";
    const res = requireNotReadOnly();
    expect(res).not.toBeNull();
    expect(res?.status).toBe(503);
    const body = await res?.json();
    expect(body.error).toBe(
      "PatterStage is in read-only mode (set PS_READ_ONLY=true to allow writes).",
    );
  });

  it("returns 503 with em-dash extension when read-only and context provided", async () => {
    process.env.CH_READ_ONLY = "true";
    const res = requireNotReadOnly("skill toggles are disabled");
    expect(res?.status).toBe(503);
    const body = await res?.json();
    expect(body.error).toBe(
      "PatterStage is in read-only mode — skill toggles are disabled",
    );
  });

  it("treats empty string as no context (canonical default)", async () => {
    process.env.CH_READ_ONLY = "true";
    const res = requireNotReadOnly("");
    expect(res?.status).toBe(503);
    const body = await res?.json();
    expect(body.error).toBe(
      "PatterStage is in read-only mode (set PS_READ_ONLY=true to allow writes).",
    );
  });
});
