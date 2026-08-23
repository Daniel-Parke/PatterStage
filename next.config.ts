import type { NextConfig } from "next";

// Comma-separated full origins (scheme + host + port). scripts/bootstrap/setup.sh generates
// PS_ALLOWED_DEV_ORIGINS for your chosen PORT (localhost, 127.0.0.1, LAN IPv4s).
// CH_ALLOWED_DEV_ORIGINS is the legacy alias, kept for already-provisioned installs.

const extraOrigins = (process.env.PS_ALLOWED_DEV_ORIGINS || process.env.CH_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  // Strip scheme prefix — Next.js allowedDevOrigins expects bare host:port, not full URLs
  .map((s) => s.replace(/^https?:\/\//, ""))
  // Also add bare host without port (HMR WebSocket connections arrive without port)
  .flatMap((s) => {
    const results = [s];
    const [host] = s.split(":");
    // If the entry had a port and the bare host isn't already in the list
    if (s !== host && host) {
      results.push(host);
    }
    return results;
  });

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // Keep the native better-sqlite3 binding external from the server bundle.
  // The orchestration scheduler now opens the DB at boot (via instrumentation),
  // not just inside request handlers, so the native module must not be traced
  // into the bundle.
  serverExternalPackages: ["better-sqlite3"],

  // Allow devices on local network to access dev server (explicit list; no CIDR).
  //
  // The loopback names are hard defaults rather than setup.sh's job. Next 16
  // blocks cross-origin access to dev resources, and it treats 127.0.0.1 and
  // localhost as different origins, so opening the wrong one blocks the HMR
  // socket. In Next 16 that does not degrade to "no hot reload": hydration
  // never completes, so every page paints its server markup, sits on a
  // spinner, and issues zero API calls, with nothing in the browser console
  // to say why. Only the dev server's own log mentions it.
  //
  // That mattered here because `npm run dev` prints
  // "Open PatterStage at http://127.0.0.1:<port>/?ps_token=..." — the product
  // handed the user the one URL that breaks it, and a fresh clone that has not
  // run setup.sh has no PS_ALLOWED_DEV_ORIGINS to save it. Production is
  // unaffected: allowedDevOrigins applies to `next dev` only.
  allowedDevOrigins: ["localhost", "127.0.0.1", "[::1]", "*.local", ...extraOrigins],

  // Benchmarks + Insights moved under the Laboratory section. Keep the old
  // top-level URLs working (bookmarks, external links) via permanent redirects.
  async redirects() {
    return [
      { source: "/benchmarks", destination: "/laboratory/benchmarks", permanent: true },
      { source: "/insights", destination: "/laboratory/insights", permanent: true },
    ];
  },
};

export default nextConfig;
