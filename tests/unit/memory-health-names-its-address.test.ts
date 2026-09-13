/** @jest-environment node */

// T-0091: the subsystem row for memory read "hindsight: fetch failed" on the
// isolated instance, which told the operator nothing about WHERE. The
// provider's health error names the address it tried.

import { HindsightMemoryProvider } from "@/lib/memory/memory-providers/hindsight-provider";

it("says which address it could not reach", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  try {
    const h = await new HindsightMemoryProvider({ host: "127.0.0.1", port: 9277, bank: "hermes" }).health();
    expect(h.available).toBe(false);
    expect(h.error).toContain("http://127.0.0.1:9277");
    expect(h.error).toContain("fetch failed");
  } finally {
    globalThis.fetch = original;
  }
});
