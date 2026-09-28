import type { NextRequest } from "next/server";

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]" || host === "::1";
}

/** The configured browser origin is authority for cookies and CSRF checks. */
export function publicOrigin(request: NextRequest): URL | null {
  const configured = process.env.PS_PUBLIC_ORIGIN;
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.origin !== configured || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      if (parsed.protocol === "http:" && !isLoopback(parsed.hostname) && process.env.PS_INSECURE_LAN_HTTP !== "1") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  // The managed default listener binds loopback. Next may normalise nextUrl
  // to localhost even when the browser reached 127.0.0.1, so use the Host
  // port only when both forms are loopback. Network modes require a configured
  // public origin and must never derive one from a caller-supplied Host.
  if (process.env.PS_INSECURE_LAN_HTTP === "1" || process.env.PS_PRIVATE_PROXY_NETWORK === "1") return null;
  const direct = request.nextUrl;
  if (!isLoopback(direct.hostname)) return null;
  const host = request.headers.get("host");
  if (host) {
    try {
      const browserOrigin = new URL(`http://${host}`);
      if (isLoopback(browserOrigin.hostname) && browserOrigin.host === host.toLowerCase()) return browserOrigin;
    } catch { /* Refuse malformed Host and use only the internal loopback URL. */ }
  }
  return new URL(direct.origin);
}

export function hasExactOrigin(request: NextRequest, expected: URL): boolean {
  const supplied = request.headers.get("origin");
  return supplied === expected.origin;
}

export function sessionCookieOptions(origin: URL, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.max(0, Math.min(43_200, maxAgeSeconds)),
    secure: origin.protocol === "https:",
  };
}
