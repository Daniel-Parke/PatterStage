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

  // Every page path moved in the final-release regroup (T-0097, decision 8):
  // WORK, RESULTS and AGENT replace orchestration, laboratory, operations, the
  // config tree and the four top-level pages. Each old path answers a 307 to
  // its new address for one release, query string intact.
  //
  // 307, NEVER 308. Browsers cache a permanent redirect indefinitely, and this
  // repository has already shipped one into a 404: /benchmarks used to 308 to
  // /laboratory/benchmarks, `4935ac31 feat!: delete the benchmark subsystem`
  // deleted the page, and the dead hop outlived the URL. There is deliberately
  // still no /benchmarks entry; an honest 404 beats a permanent redirect into
  // one. tests/unit/b3-old-paths-redirect.test.ts holds every entry here to
  // `permanent: false`.
  //
  // The specific /config paths sit ABOVE the generic /config/:section, because
  // Next matches in order and Models and Seed do not live under Settings.
  async redirects() {
    const temporary = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      temporary("/orchestration/chat", "/work/chat"),
      temporary("/orchestration/missions", "/work/missions"),
      temporary("/orchestration/composer", "/work/composer"),
      temporary("/orchestration/scripts", "/work/scripts"),
      temporary("/laboratory/research", "/work/research"),
      temporary("/sessions", "/results/sessions"),
      temporary("/sessions/:id", "/results/sessions/:id"),
      temporary("/laboratory/artifacts", "/results/artifacts"),
      temporary("/laboratory/insights", "/results/insights"),
      temporary("/insights", "/results/insights"),
      temporary("/logs", "/results/logs"),
      temporary("/operations/agents", "/agent/profiles"),
      temporary("/operations/skills", "/agent/skills"),
      temporary("/operations/skills/:path*", "/agent/skills/:path*"),
      temporary("/operations/tools", "/agent/tools"),
      // Personalities folded into the Agents card as its Identity tab
      // (decision 11, T-0103). Both old paths land on that tab.
      temporary("/operations/personalities", "/agent/profiles?tab=identity"),
      temporary("/agent/personalities", "/agent/profiles?tab=identity"),
      temporary("/memory", "/agent/memory"),
      temporary("/config/models", "/agent/models"),
      temporary("/config/seed", "/agent/settings/restore"),
      temporary("/config", "/agent/settings"),
      temporary("/config/:section", "/agent/settings/:section"),
    ];
  },
};

export default nextConfig;
