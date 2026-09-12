/** @jest-environment node */
/**
 * SSRF guard for the research fetcher.
 *
 * Deep Research feeds visitPage() URLs scraped out of a search engine's HTML,
 * which is attacker-influenceable. Before this guard the server would fetch the
 * Hermes gateway on localhost, cloud instance metadata, or anything on the
 * operator's LAN, and hand the response to an LLM that wrote it into a report.
 */
import {
  checkUrlShape,
  isPrivateAddress,
  isPrivateIpv4,
  isPrivateIpv6,
} from "@/lib/search/url-guard";

describe("private address detection", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["10.1.2.3", "RFC1918"],
    ["172.16.0.1", "RFC1918 lower bound"],
    ["172.31.255.255", "RFC1918 upper bound"],
    ["192.168.0.1", "RFC1918"],
    ["169.254.169.254", "cloud instance metadata"],
    ["0.0.0.0", "this network"],
    ["100.64.0.1", "CGNAT"],
    ["224.0.0.1", "multicast"],
  ])("blocks %s (%s)", (addr) => {
    expect(isPrivateAddress(addr)).toBe(true);
  });

  it.each([["8.8.8.8"], ["1.1.1.1"], ["172.15.0.1"], ["172.32.0.1"], ["93.184.216.34"]])(
    "allows public %s",
    (addr) => {
      expect(isPrivateAddress(addr)).toBe(false);
    },
  );

  it("handles the IPv4 boundaries either side of RFC1918", () => {
    expect(isPrivateIpv4([172, 15, 0, 1])).toBe(false);
    expect(isPrivateIpv4([172, 16, 0, 1])).toBe(true);
    expect(isPrivateIpv4([172, 31, 0, 1])).toBe(true);
    expect(isPrivateIpv4([172, 32, 0, 1])).toBe(false);
  });

  it.each([
    ["::1", "loopback"],
    ["fc00::1", "unique-local"],
    ["fd12:3456::1", "unique-local"],
    ["fe80::1", "link-local"],
    ["::ffff:127.0.0.1", "IPv4-mapped loopback"],
    ["::ffff:10.0.0.1", "IPv4-mapped RFC1918"],
  ])("blocks IPv6 %s (%s)", (addr) => {
    expect(isPrivateIpv6(addr)).toBe(true);
  });

  it("allows a public IPv6 address", () => {
    expect(isPrivateIpv6("2606:4700:4700::1111")).toBe(false);
  });

  it("strips an IPv6 zone id before judging", () => {
    expect(isPrivateIpv6("fe80::1%eth0")).toBe(true);
  });
});

describe("checkUrlShape", () => {
  it.each([
    ["file:///etc/passwd", "blocked protocol"],
    ["ftp://example.com/x", "blocked protocol"],
    ["http://localhost:8642/v1/runs", "loopback hostname"],
    ["http://foo.localhost/", "loopback hostname"],
    ["http://printer.local/", "loopback hostname"],
    ["http://127.0.0.1:8642/v1/runs", "private address"],
    ["http://169.254.169.254/latest/meta-data/", "private address"],
    ["http://[::1]:3000/", "private address"],
    ["not a url", "not a valid URL"],
  ])("rejects %s", (url, reason) => {
    const v = checkUrlShape(url);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain(reason);
  });

  it("accepts an ordinary public URL", () => {
    const v = checkUrlShape("https://example.com/article?q=1");
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.url.hostname).toBe("example.com");
  });

  it("accepts a public IP literal without needing DNS", () => {
    expect(checkUrlShape("http://93.184.216.34/").ok).toBe(true);
  });
});

describe("visitPage refuses internal targets", () => {
  const html = "<html><head><title>T</title></head><body><p>x</p></body></html>";

  function mockFetch(impl: (url: string) => Partial<Response>) {
    global.fetch = jest.fn(async (input: unknown) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      return impl(url) as Response;
    }) as unknown as typeof fetch;
  }

  afterEach(() => jest.restoreAllMocks());

  it("does not fetch a loopback URL at all", async () => {
    const { visitPage } = await import("@/lib/search/visit");
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;

    expect(await visitPage("http://127.0.0.1:8642/v1/runs")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not fetch cloud metadata", async () => {
    const { visitPage } = await import("@/lib/search/visit");
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;

    expect(await visitPage("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  // The subtler half: a perfectly public URL that redirects inward. Following
  // redirects automatically would walk straight past the entry check.
  it("refuses a public URL that redirects to loopback", async () => {
    const { visitPage } = await import("@/lib/search/visit");
    const seen: string[] = [];
    mockFetch((url) => {
      seen.push(url);
      if (url.includes("example.com")) {
        return {
          ok: false,
          status: 302,
          headers: { get: (h: string) => (h.toLowerCase() === "location" ? "http://127.0.0.1:8642/v1/runs" : null) },
        } as Partial<Response>;
      }
      return {
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "text/html" : null) },
        text: async () => html,
      } as Partial<Response>;
    });

    expect(await visitPage("https://example.com/a")).toBeNull();
    expect(seen).toEqual(["https://example.com/a"]);
    expect(seen.some((u) => u.includes("127.0.0.1"))).toBe(false);
  });
});
