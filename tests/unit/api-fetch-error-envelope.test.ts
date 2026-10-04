/** @jest-environment node */
import { apiFetch } from "@/lib/api/api-fetch";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

describe("T-0192 failed HTTP envelopes", () => {
  it.each([
    ["null", null], ["false", false], ["number", 7], ["string", "refused"],
    ["array", []], ["object", {}], ["nested null", { data: null }],
    ["nested array", { data: [] }], ["non-string error", { error: 17 }],
  ])("retains HTTP diagnosis for %s", async (_name, body) => {
    global.fetch = jest.fn().mockResolvedValue(Response.json(body, { status: 503 }));
    const outcome = await apiFetch("/api/oracle").then(
      value => ({ status: "fulfilled" as const, value }),
      reason => ({ status: "rejected" as const, value: reason }),
    );
    expect(outcome.status).toBe("rejected");
    expect(outcome.value).toMatchObject({ message: "HTTP 503", status: 503, body });
  });

  it.each([
    ["top-level precedence", { error: "Top refused", data: { error: "Nested refused" } }, "Top refused"],
    ["nested error", { data: { error: "Nested refused" } }, "Nested refused"],
    ["cron detail", { error: "Saved partly", cronPushError: "YAML refused" }, "Saved partly: YAML refused"],
    ["cron without error", { cronPushError: "YAML refused" }, "HTTP 503: YAML refused"],
    ["blank cron detail", { error: "Refused", cronPushError: "  " }, "Refused"],
  ])("preserves the published %s", async (_name, body, message) => {
    global.fetch = jest.fn().mockResolvedValue(Response.json(body, { status: 503 }));
    await expect(apiFetch("/api/oracle")).rejects.toMatchObject({ message, status: 503, body });
  });

  it("keeps invalid JSON and its HTTP status distinguishable from a published error", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("<html>unavailable</html>", { status: 502 }));
    await expect(apiFetch("/api/oracle")).rejects.toThrow("API returned invalid JSON (HTTP 502)");
  });

  it("returns HTTP200 partial success unchanged for the owning caller to interpret", async () => {
    const body = { data: { error: "SQLite saved; YAML refused" } };
    global.fetch = jest.fn().mockResolvedValue(Response.json(body));
    await expect(apiFetch("/api/oracle")).resolves.toEqual(body);
  });
});
