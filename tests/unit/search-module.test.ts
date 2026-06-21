/** @jest-environment node */
// Coverage for the shared search module: SearXNG JSON parsing, the visit
// HTML→text extractor, and provider resolution.

import { searxngProvider } from "@/lib/search/searxng";
import { visitPage } from "@/lib/search/visit";
import { resolveSearchProvider, nullSearchProvider } from "@/lib/search";

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.PS_SEARCH_PROVIDER;
  delete process.env.PS_SEARXNG_URL;
});

describe("search module", () => {
  it("searxng parses JSON results and drops non-http rows", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { title: "A", url: "https://a.com", content: "snip" },
          { title: "B", url: "not-a-url", content: "" },
        ],
      }),
    } as unknown as Response);

    const provider = searxngProvider("http://localhost:8888");
    const results = await provider.search("q", 5);
    expect(results).toEqual([{ title: "A", url: "https://a.com", snippet: "snip" }]);
  });

  it("visitPage extracts readable text and strips scripts", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html" },
      text: async () =>
        "<html><head><title>Hi</title></head><body><script>danger()</script><p>Hello world</p></body></html>",
    } as unknown as Response);

    const page = await visitPage("https://x.com");
    expect(page?.title).toBe("Hi");
    expect(page?.content).toContain("Hello world");
    expect(page?.content).not.toContain("danger()");
  });

  it("resolveSearchProvider defaults to duckduckgo, honors 'none' + SearXNG url", () => {
    expect(resolveSearchProvider().name).toBe("duckduckgo");

    process.env.PS_SEARCH_PROVIDER = "none";
    expect(resolveSearchProvider()).toBe(nullSearchProvider);
    delete process.env.PS_SEARCH_PROVIDER;

    process.env.PS_SEARXNG_URL = "http://localhost:8888";
    expect(resolveSearchProvider().name).toBe("searxng");
  });
});
