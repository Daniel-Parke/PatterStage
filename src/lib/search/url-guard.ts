// ═══════════════════════════════════════════════════════════════
// search/url-guard.ts — refuse to fetch anything that is not on the public web
//
// Deep Research feeds the fetcher URLs that came from a search engine's HTML,
// which is attacker-influenceable: DuckDuckGo results carry a `uddg=` redirect
// parameter, pages can be SEO-placed, and a prompt can steer a query. Without a
// guard the server will happily fetch:
//
//   http://127.0.0.1:8642/v1/runs   the Hermes gateway, on the same host
//   http://169.254.169.254/         cloud instance metadata (credentials)
//   http://192.168.1.1/             anything on the operator's LAN
//   file:///etc/passwd              local files
//
// and hand the response body to an LLM that then writes it into a report.
//
// Two layers, because either alone is bypassable:
//   1. Protocol + hostname literal checks (cheap, catches the obvious).
//   2. DNS resolution, checking EVERY returned address — a public hostname can
//      resolve to 127.0.0.1, which is the standard SSRF bypass.
//
// Redirects are handled by the caller: each hop must be re-checked, or a public
// URL that 302s to localhost walks straight past this.
// ═══════════════════════════════════════════════════════════════

import { lookup } from "dns/promises";

export type UrlVerdict = { ok: true; url: URL } | { ok: false; reason: string };

/** Parse an IPv4 dotted quad, or null if it is not one. */
function parseIpv4(host: string): number[] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

/** True for any IPv4 address that is not routable on the public internet. */
export function isPrivateIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/** True for IPv6 loopback, unique-local, link-local, or a mapped private v4. */
export function isPrivateIpv6(address: string): boolean {
  const addr = address.toLowerCase().split("%")[0]; // strip zone id
  if (addr === "::1" || addr === "::") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true; // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return true; // fe80::/10 link-local
  // ::ffff:a.b.c.d — an IPv4 address wearing an IPv6 hat
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) {
    const parts = parseIpv4(mapped[1]);
    return parts ? isPrivateIpv4(parts) : true;
  }
  return false;
}

export function isPrivateAddress(address: string): boolean {
  const v4 = parseIpv4(address);
  if (v4) return isPrivateIpv4(v4);
  if (address.includes(":")) return isPrivateIpv6(address);
  return false;
}

/**
 * Synchronous checks only. Exported so callers can filter a result list before
 * paying for DNS on every candidate.
 */
export function checkUrlShape(raw: string): UrlVerdict {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "not a valid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `blocked protocol ${url.protocol}` };
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return { ok: false, reason: "no hostname" };
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, reason: "loopback hostname" };
  }
  if (isPrivateAddress(host)) {
    return { ok: false, reason: `private address ${host}` };
  }
  return { ok: true, url };
}

/**
 * Full check, including DNS. Returns the parsed URL when it is safe to fetch.
 *
 * Note the residual race: the name is resolved here and again by fetch(), so a
 * hostile DNS server could answer differently the second time. Closing that
 * needs a pinned-IP fetch with a Host header, which is not worth the complexity
 * for a research fetcher whose output is treated as untrusted text anyway. The
 * realistic attacks (a literal internal URL, a redirect to one, a public name
 * pointed at 127.0.0.1) are all covered.
 */
export async function checkUrlSafe(raw: string): Promise<UrlVerdict> {
  const shape = checkUrlShape(raw);
  if (!shape.ok) return shape;

  const host = shape.url.hostname.replace(/^\[|\]$/g, "");
  if (isPrivateAddress(host)) return { ok: false, reason: `private address ${host}` };

  // An IP literal needs no lookup; a name does, and every address it returns
  // must be public or the name is a bypass.
  if (parseIpv4(host) || host.includes(":")) return shape;

  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0) return { ok: false, reason: "hostname did not resolve" };
    for (const { address } of addresses) {
      if (isPrivateAddress(address)) {
        return { ok: false, reason: `${host} resolves to private address ${address}` };
      }
    }
  } catch {
    return { ok: false, reason: "hostname did not resolve" };
  }

  return shape;
}
