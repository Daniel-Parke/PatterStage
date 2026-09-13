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

/**
 * The eight hextets of an IPv6 address, or null if it is not one.
 *
 * This exists instead of a regex per prefix because `::` stands for any run of
 * zero hextets, so one address has many spellings and a regex counting colons
 * reads a different position in each. `2002:a9fe::1` and `2002:a9fe:0:0:0:0:0:1`
 * are the same address — 6to4 for the cloud metadata range — and only the second
 * makes that visible. Put the run back first, and the v4 a carrier prefix holds
 * always sits at a fixed index.
 */
function expandIpv6(address: string): number[] | null {
  if (!/^[0-9a-f:]*$/.test(address)) return null;
  const runs = address.match(/::/g);
  if (runs && runs.length > 1) return null;
  const compressed = address.includes("::");
  const [head, tail] = compressed ? address.split("::") : [address, ""];
  const left = head === "" ? [] : head.split(":");
  const right = !compressed || tail === "" ? [] : tail.split(":");
  if (!compressed && left.length !== 8) return null;
  if (left.length + right.length > 8) return null;
  const groups = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  if (!groups.every((h) => /^[0-9a-f]{1,4}$/.test(h))) return null;
  return groups.map((h) => Number.parseInt(h, 16));
}

/**
 * The IPv4 address an IPv6 one carries, or null when it carries none.
 *
 * Only these prefixes carry one. An ordinary address whose last 32 bits happen
 * to spell a private v4 — 2001:db8::7f00:1 — is not loopback and is not refused.
 */
function carriedIpv4(h: number[]): number[] | null {
  const octets = (high: number, low: number) => [high >> 8, high & 255, low >> 8, low & 255];
  const zeros = (from: number, to: number) => h.slice(from, to).every((x) => x === 0);
  // 2002::/16, 6to4: the v4 is the two hextets straight after the prefix.
  if (h[0] === 0x2002) return octets(h[1], h[2]);
  // 64:ff9b::/96, RFC 6052's well-known NAT64 prefix.
  if (h[0] === 0x64 && h[1] === 0xff9b && zeros(2, 6)) return octets(h[6], h[7]);
  // ::ffff:0:0/96 IPv4-mapped, and ::/96 IPv4-compatible: deprecated, still parsed.
  if (zeros(0, 5) && (h[5] === 0xffff || h[5] === 0)) return octets(h[6], h[7]);
  return null;
}

/** True for IPv6 loopback, unique-local, link-local, or a private v4 inside it. */
export function isPrivateIpv6(address: string): boolean {
  const addr = address.toLowerCase().split("%")[0]; // strip zone id
  if (addr === "::1" || addr === "::") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true; // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return true; // fe80::/10 link-local

  // ::ffff:a.b.c.d — an IPv4 address wearing an IPv6 hat, as a person types it.
  // Rewritten to hextets rather than answered here, so the carrier prefix still
  // decides: 2001:db8::1.2.3.4 is a legal public address, not a v4 in disguise.
  const dotted = addr.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  let normalised = addr;
  if (dotted) {
    const parts = parseIpv4(dotted[2]);
    if (!parts) return true; // looks like a dotted tail and is not one: refuse
    const high = ((parts[0] << 8) | parts[1]).toString(16);
    const low = ((parts[2] << 8) | parts[3]).toString(16);
    normalised = `${dotted[1]}${high}:${low}`;
  }

  // Deep Research fetches whatever the parser produced, and the parser
  // normalises: `new URL("http://[::ffff:127.0.0.1]/")` reports its hostname as
  // `[::ffff:7f00:1]`. These are the spellings that reach the socket.
  const hextets = expandIpv6(normalised);
  if (!hextets) return false;
  const carried = carriedIpv4(hextets);
  return carried ? isPrivateIpv4(carried) : false;
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
