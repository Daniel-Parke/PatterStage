/**
 * @jest-environment node
 *
 * Storing a memory when no provider is configured has to say two things: that
 * memory has no provider, and where to choose one. It said neither.
 *
 * The chain, end to end:
 *
 *   UnavailableMemoryProvider.request() threw "No memory provider is
 *   configured. There is nothing to query." True, but a person who has just
 *   pressed Store is not querying, and the sentence names no next action.
 *
 *   The route wrapped it in `{ data: { available: false, error } }` with a 500.
 *   A failing response puts its message in the TOP-LEVEL `error` field
 *   everywhere else in the app (see @/lib/api-response), so the one field the
 *   client reads on a non-2xx was empty and the toast read "HTTP 500".
 *
 * The client-side half of the fix is in api-error-keeps-the-servers-message.test.ts.
 * This file pins the producer: the sentence, and where on the wire it sits.
 */

import { NextRequest } from "next/server";

import { UnavailableMemoryProvider } from "@/lib/memory/memory-providers/unavailable-provider";

jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

// The whole point of the case: the active provider is "none", so nothing can
// serve the write. Mocked at the module the transport imports, so the route
// runs for real from parseJsonBody down to the catch branch.
jest.mock("@/lib/memory/memory-providers", () => {
  const {
    UnavailableMemoryProvider: Unavailable,
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factory cannot use the ESM import above
  } = require("@/lib/memory/memory-providers/unavailable-provider");
  return {
    getActiveMemoryProvider: () => new Unavailable("none"),
    getActiveMemoryConfig: () => ({
      type: "none",
      config: { host: "127.0.0.1", port: 9177, bank: "hermes" },
    }),
    getMemoryProviderType: () => "none",
  };
});

function retainRequest(): NextRequest {
  return new NextRequest("http://localhost/api/memory/hindsight", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "retain", content: "remember this" }),
  });
}

describe("the provider that cannot serve anything", () => {
  it("names the missing configuration and where to set it", async () => {
    const provider = new UnavailableMemoryProvider("none");
    await expect(provider.request()).rejects.toThrow(/no memory provider is configured/i);
    await expect(provider.request()).rejects.toThrow(/Memory page/);
  });

  it("does not tell someone storing a memory that there is nothing to query", async () => {
    const provider = new UnavailableMemoryProvider("none");
    await expect(provider.request()).rejects.not.toThrow(/nothing to query/i);
  });

  /**
   * AMENDED. This case used to require `/Memory page/` here too, on the
   * reasoning that every refusal should point somewhere. It pointed the reader
   * at a control that does not exist: the sentence read "Choose a different
   * provider in the memory provider card at the top of the Memory page", and
   * that card holds Host, Port, Bank, Test connection and Save, with Save
   * posting `type: current.type` -- the same provider it loaded. No provider
   * chooser exists in src/components/memory, and config-schema.ts renders
   * `memory.provider` read-only, so the product cannot change provider type at
   * all.
   *
   * The demand is therefore replaced, not dropped, and by a stricter one: name
   * the provider, name what is missing, and promise no control. The `none`
   * case below still requires the Memory page, because there the page really
   * does carry the fix.
   */
  it("names the selected provider when it is the client that is missing", async () => {
    const provider = new UnavailableMemoryProvider("holographic");
    await expect(provider.request()).rejects.toThrow(/holographic/);
    await expect(provider.request()).rejects.toThrow(/no client/i);
    await expect(provider.request()).rejects.not.toThrow(/choose a different provider/i);
    await expect(provider.request()).rejects.not.toThrow(/provider card/i);
  });

  it("says the same thing to a health check as to a write", async () => {
    const health = await new UnavailableMemoryProvider("none").health();
    expect(health.available).toBe(false);
    expect(health.error).toMatch(/Memory page/);
  });
});

describe("POST /api/memory/hindsight with no provider configured", () => {
  it("puts the reason in the top-level error field the client reads", async () => {
    const { POST } = await import("@/app/api/memory/hindsight/route");
    const res = await POST(retainRequest());
    const body = (await res.json()) as { error?: string; data?: { error?: string } };

    expect(body.error).toMatch(/no memory provider is configured/i);
    expect(body.error).toMatch(/Memory page/);
  });

  it("keeps the data envelope the memory browser reads, with the same sentence", async () => {
    const { POST } = await import("@/app/api/memory/hindsight/route");
    const res = await POST(retainRequest());
    const body = (await res.json()) as {
      error?: string;
      data?: { available?: boolean; error?: string };
    };

    expect(body.data?.available).toBe(false);
    expect(body.data?.error).toBe(body.error);
  });
});
