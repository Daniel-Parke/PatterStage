/**
 * api-response — unit tests for the NextResponse factory helpers.
 *
 * `badRequest` (400), `notFound` (404), and `serverError` (500) are
 * the shared error-response factories that replaced inline
 * `return NextResponse.json({ error: msg }, { status: <code> })`
 * returns across sessions, models, config, agent/files, agent/profiles,
 * and seed routes. They must (a) always return the locked status code,
 * (b) always wrap the body as `{ error }`, and (c) round-trip through
 * `NextResponse.json` so the JSON Content-Type is set.
 */

import { badRequest, notFound, serverError } from "@/lib/api-response";

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

describe("notFound", () => {
  it("returns a response with status 404", async () => {
    const res = notFound("Model not found");
    expect(res.status).toBe(404);
  });

  it("body is { error: <message> }", async () => {
    const res = notFound("Model not found");
    const body = await res.json();
    expect(body).toEqual({ error: "Model not found" });
  });

  it("preserves the exact error message", async () => {
    const res = notFound(`Profile 'foo' not found`);
    const body = await res.json();
    expect(body.error).toBe("Profile 'foo' not found");
  });

  it("empty string is a valid error message", async () => {
    const res = notFound("");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "" });
  });
});

describe("serverError", () => {
  it("returns a response with status 500", async () => {
    const res = serverError("Failed to read config.yaml");
    expect(res.status).toBe(500);
  });

  it("body is { error: <message> }", async () => {
    const res = serverError("Failed to read config.yaml");
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to read config.yaml" });
  });

  it("preserves the exact error message including special characters", async () => {
    const res = serverError("Failed to write file: /tmp/foo bar/baz.md");
    const body = await res.json();
    expect(body.error).toBe("Failed to write file: /tmp/foo bar/baz.md");
  });

  it("empty string is a valid error message", async () => {
    const res = serverError("");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "" });
  });
});
