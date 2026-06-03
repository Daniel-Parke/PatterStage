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

import {
  badRequest,
  conflict,
  created,
  forbidden,
  methodNotAllowed,
  notFound,
  ok,
  payloadTooLarge,
  serverError,
  serviceUnavailable,
} from "@/lib/api-response";

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

describe("forbidden", () => {
  it("returns a response with status 403", async () => {
    const res = forbidden("Section 'foo' is not writable");
    expect(res.status).toBe(403);
  });

  it("body is { error: <message> }", async () => {
    const res = forbidden("Section 'foo' is not writable");
    const body = await res.json();
    expect(body).toEqual({ error: "Section 'foo' is not writable" });
  });

  it("preserves the exact error message including special characters", async () => {
    const res = forbidden(
      "Section 'cron' is not writable. Allowed: agent, models, fallbacks",
    );
    const body = await res.json();
    expect(body.error).toBe(
      "Section 'cron' is not writable. Allowed: agent, models, fallbacks",
    );
  });

  it("empty string is a valid error message", async () => {
    const res = forbidden("");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "" });
  });
});

describe("conflict", () => {
  it("returns a response with status 409", async () => {
    const res = conflict(`Profile "qa" already exists`);
    expect(res.status).toBe(409);
  });

  it("body is { error: <message> }", async () => {
    const res = conflict(`Profile "qa" already exists`);
    const body = await res.json();
    expect(body).toEqual({ error: `Profile "qa" already exists` });
  });

  it("preserves the exact error message including special characters", async () => {
    const res = conflict(`Profile "weird/slug:with-chars" already exists`);
    const body = await res.json();
    expect(body.error).toBe(`Profile "weird/slug:with-chars" already exists`);
  });

  it("empty string is a valid error message", async () => {
    const res = conflict("");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: "" });
  });
});

describe("methodNotAllowed", () => {
  it("returns a response with status 405", async () => {
    const res = methodNotAllowed("Tool registry mutations are disabled");
    expect(res.status).toBe(405);
  });

  it("body is { error: <message> }", async () => {
    const res = methodNotAllowed("DELETE is not supported on this resource");
    const body = await res.json();
    expect(body).toEqual({ error: "DELETE is not supported on this resource" });
  });

  it("preserves the exact error message including special characters", async () => {
    const res = methodNotAllowed(
      "Tool registry mutations are disabled. Configure Hermes runtime toolsets on Operations → Tools (profile-scoped platform_toolsets).",
    );
    const body = await res.json();
    expect(body.error).toBe(
      "Tool registry mutations are disabled. Configure Hermes runtime toolsets on Operations → Tools (profile-scoped platform_toolsets).",
    );
  });

  it("empty string is a valid error message", async () => {
    const res = methodNotAllowed("");
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body).toEqual({ error: "" });
  });
});

describe("payloadTooLarge", () => {
  it("returns a response with status 413", async () => {
    const res = payloadTooLarge("Session file is too large to load");
    expect(res.status).toBe(413);
  });

  it("body is { error: <message> }", async () => {
    const res = payloadTooLarge("File is 50 MB, max is 10 MB");
    const body = await res.json();
    expect(body).toEqual({ error: "File is 50 MB, max is 10 MB" });
  });

  it("preserves the exact error message including dynamic numbers", async () => {
    const res = payloadTooLarge(
      "Session file is too large to load in Control Hub (max 10 MB).",
    );
    const body = await res.json();
    expect(body.error).toBe(
      "Session file is too large to load in Control Hub (max 10 MB).",
    );
  });

  it("empty string is a valid error message", async () => {
    const res = payloadTooLarge("");
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body).toEqual({ error: "" });
  });
});

describe("serviceUnavailable", () => {
  it("returns a response with status 503", async () => {
    const res = serviceUnavailable("mission_categories table is missing");
    expect(res.status).toBe(503);
  });

  it("body is { error: <message> }", async () => {
    const res = serviceUnavailable("Control Hub is in read-only mode");
    const body = await res.json();
    expect(body).toEqual({ error: "Control Hub is in read-only mode" });
  });

  it("preserves the exact error message including newlines and special chars", async () => {
    const res = serviceUnavailable(
      "migration_required — restart Control Hub or run npm run db:migrate",
    );
    const body = await res.json();
    expect(body.error).toBe(
      "migration_required — restart Control Hub or run npm run db:migrate",
    );
  });

  it("empty string is a valid error message", async () => {
    const res = serviceUnavailable("");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "" });
  });
});

describe("created", () => {
  it("returns a response with status 201", async () => {
    const res = created({ id: "abc" });
    expect(res.status).toBe(201);
  });

  it("body is { data: <input> } — the input shape is preserved verbatim", async () => {
    const res = created({ session: { id: "s1", title: "new session" } });
    const body = await res.json();
    expect(body).toEqual({ data: { session: { id: "s1", title: "new session" } } });
  });

  it("generic preserves the caller's type — works with arbitrary resource shapes", async () => {
    // The 5 call sites that motivated this factory all use it with a
    // different resource shape: { model }, { credential }, { session },
    // { entry }, { category }. The generic <T> is what makes
    // `created({ model })` and `created({ entry })` look identical at
    // the call site — the type flows through without a cast.
    const modelRes = created({ model: { id: "m1", name: "M" } });
    const entryRes = created({ entry: { id: "e1", value: 1 } });
    expect(await modelRes.json()).toEqual({ data: { model: { id: "m1", name: "M" } } });
    expect(await entryRes.json()).toEqual({ data: { entry: { id: "e1", value: 1 } } });
  });

  it("null body is allowed — the wire shape is { data: null }", async () => {
    // Some Created responses in the codebase intentionally return no
    // body beyond the success signal (e.g. { success: true, job } where
    // the job is the only payload). The factory should not crash on
    // edge payloads.
    const res = created(null);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ data: null });
  });
});

describe("ok", () => {
  it("returns a response with status 200", async () => {
    const res = ok({ id: "abc" });
    expect(res.status).toBe(200);
  });

  it("body is { data: <input> } — the input shape is preserved verbatim", async () => {
    const res = ok({ drift: { items: ["a", "b"] } });
    const body = await res.json();
    expect(body).toEqual({ data: { drift: { items: ["a", "b"] } } });
  });

  it("is byte-equivalent to the inline `return NextResponse.json({ data })` form", async () => {
    // This is the most important property: the 31 sites migrated to
    // `ok(...)` in session 111 must produce wire-identical output to
    // the pre-refactor inline form. The factory body is literally
    // `NextResponse.json({ data }, { status: 200 })` — but the
    // important verification is at the wire level (status + JSON
    // body shape), not the implementation detail.
    const res = ok({ models: [{ id: "m1" }, { id: "m2" }] });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await res.json();
    expect(body).toEqual({ data: { models: [{ id: "m1" }, { id: "m2" }] } });
  });

  it("generic <T> preserves arbitrary resource shapes — the call sites use it with { model }, { drift }, { fallbacks }, { success: true, slug }, etc.", async () => {
    // The 31 sites span 18 files with very different resource shapes.
    // The generic <T> means `ok({ model })` and `ok({ drift })` look
    // identical at the call site — the type flows through without a
    // cast. This test pins the runtime behaviour for the most common
    // shapes seen in the migration.
    const modelRes = ok({ model: { id: "m1", name: "M" } });
    const driftRes = ok({ drift: { added: [], removed: [] } });
    const flagRes = ok({ success: true, deleted: "abc" });
    expect(await modelRes.json()).toEqual({ data: { model: { id: "m1", name: "M" } } });
    expect(await driftRes.json()).toEqual({ data: { drift: { added: [], removed: [] } } });
    expect(await flagRes.json()).toEqual({ data: { success: true, deleted: "abc" } });
  });

  it("passes through a pre-built object (the `data` variable pattern in fs/git/branches and orchestration/chat)", async () => {
    // Two of the 31 migrated sites pass through a variable rather than
    // an inline object: `src/app/api/fs/git/branches/route.ts:25`
    // (`return NextResponse.json({ data })` where `data` is the result
    // of a prior `await`) and `src/app/api/orchestration/chat/route.ts:52`.
    // The factory must accept arbitrary T — including a pre-built
    // object — without unwrapping it.
    const payload = { branches: ["main", "dev"], current: "main" };
    const res = ok(payload);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: payload });
  });

  it("null body is allowed — the wire shape is { data: null }", async () => {
    // Some success responses in the codebase intentionally return no
    // payload (e.g. a `POST /api/agent/files/[key]` PUT that returns
    // `{ success: true, key, path }` — but a no-content acknowledgement
    // could just be `ok(null)`). The factory must not crash on edge
    // payloads.
    const res = ok(null);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: null });
  });

  it("empty object body is allowed — the wire shape is { data: {} }", async () => {
    const res = ok({});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: {} });
  });
});
