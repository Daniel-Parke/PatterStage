import type { NextConfig } from "next";

import { settingsSectionIds } from "./src/lib/config/config-sections";

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

  // PatterStage refuses to be shown inside a frame (critic-04, ruled
  // 2026-09-12). Every response with a body carries both headers: pages, API
  // answers, the proxy's own 401 and 503, and 404s, all measured against a
  // running server. The redirects() entries below answer a bodiless 307 and do
  // not, which costs nothing — there is no document there to frame, and the
  // page each one lands on refuses.
  //
  // The reason it mattered is that SameSite=Lax is decided by SITE, not by
  // port. A page served on another port of the same host or IP is same-site,
  // so a frame there receives the ps_session cookie, and src/proxy.ts's
  // same-origin check accepts the Sec-Fetch-Site value a click inside a
  // same-origin frame produces. That is enough to trick clicks on the deploy,
  // script and credential controls — which is to say, on shell access.
  //
  // DENY rather than SAMEORIGIN, because nothing here embeds PatterStage in
  // anything: the only iframe mentions in the tree are a comment on the help
  // page saying it is NOT an iframe, and an entry in a focusable-element
  // selector list. Both headers are sent, because X-Frame-Options is what old
  // browsers read and frame-ancestors is what the standard says.
  //
  // This is a frame-ancestors policy and nothing else. A script-src CSP needs
  // Next's nonce support and a build, and is deliberately a separate piece of
  // work rather than something smuggled in beside a one-line header.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },

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
      // The 27 section editors are sections of the one Settings page now
      // (decision 7, T-0125): a bookmarked section lands on its anchor. One
      // entry per section, enumerated from the catalogue rather than matched
      // by a pattern, because /agent/settings/restore and /system are pages
      // of their own and a pattern would catch them too.
      ...settingsSectionIds().map((id) => temporary(`/agent/settings/${id}`, `/agent/settings#${id}`)),
      // Five Story Weaver entries became two (decision 6, T-0126): the library
      // is the page at the door, and Characters and Themes are panels on
      // Create, so each old address lands where its content went.
      temporary("/recroom/story-weaver/library", "/recroom/story-weaver"),
      temporary("/recroom/story-weaver/characters", "/recroom/story-weaver/create#characters"),
      temporary("/recroom/story-weaver/themes", "/recroom/story-weaver/create#themes"),
    ];
  },
};

export default nextConfig;
