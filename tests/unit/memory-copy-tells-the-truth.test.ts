/**
 * @jest-environment node
 *
 * Three sentences the memory surface says that are not true of this product.
 *
 * 1. THE CONTROL THAT DOES NOT EXIST. A provider with no client told the
 *    reader to "Choose a different provider in the memory provider card at the
 *    top of the Memory page". That card holds Host, Port, Bank, Test
 *    connection and Save, and Save posts `type: current.type` -- the SAME
 *    provider. There is no provider chooser in src/components/memory, and
 *    config-schema.ts renders `memory.provider` read-only. The product cannot
 *    change provider type at all.
 *
 * 2. THE ADVICE THAT POINTS AT ITSELF. The unconfigured message said "Set one
 *    up in the memory provider card at the top of the Memory page", and
 *    the health banner is rendered inside that very card (MemoryProviderSettings.tsx
 *    is its ONLY call site). It named a destination the reader was already
 *    standing in, and no action. healthBannerMessage then prefixed "Hindsight:"
 *    onto a sentence about there being no provider.
 *
 * 3. THE COMMONEST FAILURE, IN NODE'S WORDS. Provider configured, nothing
 *    listening: the store toast reads "fetch failed". health-message.ts already
 *    declares that string unfit for a human and translates it for the banner;
 *    the route that feeds the toast publishes it raw.
 */

import { healthBannerMessage } from "@/components/memory/hindsight/health-message";
import type { HealthState } from "@/components/memory/hindsight/types";
import { UnavailableMemoryProvider } from "@/lib/memory/memory-providers/unavailable-provider";

jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

// A provider that is configured and simply is not running. The thrown shape is
// undici's: a "fetch failed" wrapper with the fact one level down in `cause`,
// which is what messageFromError joins into the sentence the route publishes.
jest.mock("@/lib/memory/memory-providers", () => ({
  getActiveMemoryProvider: () => ({
    type: "hindsight",
    baseUrl: "http://127.0.0.1:9177",
    bankBase: () => "/v1/default/banks/hermes",
    request: () => {
      throw new TypeError("fetch failed", {
        cause: new Error("connect ECONNREFUSED 127.0.0.1:9177"),
      });
    },
    health: async () => ({ available: false, error: "fetch failed" }),
    stats: async () => ({ available: false, factCount: 0 }),
  }),
  getActiveMemoryConfig: () => ({
    type: "hindsight",
    config: { host: "127.0.0.1", port: 9177, bank: "hermes" },
  }),
  getMemoryProviderType: () => "hindsight",
}));

async function reasonFor(type: "none" | "holographic"): Promise<string> {
  const health = await new UnavailableMemoryProvider(type).health();
  return health.error ?? "";
}

describe("a provider with no client does not promise a control the product lacks", () => {
  it("never tells the reader to choose a different provider", async () => {
    const reason = await reasonFor("holographic");
    expect(reason).not.toMatch(/choose a different provider/i);
    expect(reason).not.toMatch(/provider card/i);
  });

  it("still names which provider is selected", async () => {
    expect(await reasonFor("holographic")).toMatch(/holographic/);
  });
});

describe("the unconfigured message names an action, not the card it is printed in", () => {
  it("does not send the reader to the card the banner is rendered inside", async () => {
    const reason = await reasonFor("none");
    expect(reason).not.toMatch(/provider card/i);
  });

  it("names the controls that actually exist on that card", async () => {
    const reason = await reasonFor("none");
    expect(reason).toMatch(/Host/);
    expect(reason).toMatch(/Port/);
    expect(reason).toMatch(/Save/);
  });
});

describe("the banner does not put Hindsight's name on a no-provider sentence", () => {
  it("prints PatterStage's own notice verbatim", async () => {
    const reason = await reasonFor("none");
    const health = { available: false, error: reason } as unknown as HealthState;
    expect(healthBannerMessage(health)).toBe(reason);
  });

  it("does the same for a provider with no client", async () => {
    const reason = await reasonFor("holographic");
    const health = { available: false, error: reason } as unknown as HealthState;
    expect(healthBannerMessage(health)).not.toMatch(/^Hindsight/);
  });
});

describe("provider configured, nothing listening: the toast says something actionable", () => {
  it("POST /api/memory/hindsight does not publish Node's phrasing", async () => {
    const { POST } = await import("@/app/api/memory/hindsight/route");
    const { NextRequest } = await import("next/server");
    const res = await POST(
      new NextRequest("http://localhost/api/memory/hindsight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "retain", content: "remember this" }),
      }),
    );
    const body = (await res.json()) as { error?: string; data?: { error?: string } };

    expect(body.error).toContain("No memory provider is answering");
    expect(body.error).not.toMatch(/fetch failed/i);
    expect(body.error).not.toMatch(/ECONNREFUSED/i);
    // The memory browser reads the envelope copy; both halves stay the same
    // sentence, which is the contract the earlier fix established.
    expect(body.data?.error).toBe(body.error);
  });

  it("GET /api/memory/hindsight does not publish Node's phrasing either", async () => {
    const { GET } = await import("@/app/api/memory/hindsight/route");
    const { NextRequest } = await import("next/server");
    const res = await GET(
      new NextRequest("http://localhost/api/memory/hindsight?action=list"),
    );
    const body = (await res.json()) as { error?: string; data?: { error?: string } };

    expect(body.error).toContain("No memory provider is answering");
    expect(body.error).not.toMatch(/fetch failed/i);
    expect(body.data?.error).toBe(body.error);
  });

  it("the banner and the toast say the same sentence", async () => {
    const { POST } = await import("@/app/api/memory/hindsight/route");
    const { NextRequest } = await import("next/server");
    const res = await POST(
      new NextRequest("http://localhost/api/memory/hindsight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "retain", content: "x" }),
      }),
    );
    const body = (await res.json()) as { error?: string };
    const banner = healthBannerMessage({ available: false, error: "fetch failed" } as unknown as HealthState);

    expect(body.error).toBe(banner);
  });
});
