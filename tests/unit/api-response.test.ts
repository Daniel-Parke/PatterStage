/**
 * api-response — unit tests for the NextResponse factory helpers.
 *
 * `badRequest` is the shared 400-error factory that replaced 14
 * `return NextResponse.json({ error: msg }, { status: 400 })` returns
 * across sessions and memory/hindsight routes. It must (a) always
 * return 400, (b) always wrap the body as `{ error }`, and (c) round-
 * trip through `NextResponse.json` so the JSON Content-Type is set.
 */

import { badRequest } from "@/lib/api-response";

describe("badRequest", () => {
  it("returns a response with status 400", async () => {
    const res = badRequest("missing field");
    expect(res.status).toBe(400);
  });

  it("body is { error: <message> }", async () => {
    const res = badRequest("missing field");
    const body = await res.json();
    expect(body).toEqual({ error: "missing field" });
  });

  it("preserves the exact error message including special characters", async () => {
    const res = badRequest(`Unknown action: ${"x".repeat(200)}`);
    const body = await res.json();
    expect(body.error).toContain("Unknown action: ");
    expect(body.error.length).toBe("Unknown action: ".length + 200);
  });

  it("empty string is a valid error message", async () => {
    const res = badRequest("");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "" });
  });
});
