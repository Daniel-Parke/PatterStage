/** @jest-environment node */
/**
 * B3 (T-0097), decision 8: every old page path answers 307 to its new address
 * for one release. 307, never 308: a browser caches a permanent redirect for
 * ever, and this repository has already shipped one into a 404 once
 * (next.config.ts explains /benchmarks).
 */
import nextConfig from "../../next.config";
import { allModuleRoutes } from "@/lib/modules/registry";

const EXPECTED: Array<[string, string]> = [
  ["/orchestration/chat", "/work/chat"],
  ["/orchestration/missions", "/work/missions"],
  ["/orchestration/composer", "/work/composer"],
  ["/orchestration/scripts", "/work/scripts"],
  ["/laboratory/research", "/work/research"],
  ["/sessions", "/results/sessions"],
  ["/sessions/:id", "/results/sessions/:id"],
  ["/laboratory/artifacts", "/results/artifacts"],
  ["/laboratory/insights", "/results/insights"],
  ["/insights", "/results/insights"],
  ["/logs", "/results/logs"],
  ["/operations/agents", "/agent/profiles"],
  ["/operations/skills", "/agent/skills"],
  ["/operations/skills/:path*", "/agent/skills/:path*"],
  ["/operations/tools", "/agent/tools"],
  // Personalities folded into the Agents card (decision 11, T-0103).
  ["/operations/personalities", "/agent/profiles?tab=identity"],
  ["/agent/personalities", "/agent/profiles?tab=identity"],
  ["/memory", "/agent/memory"],
  ["/config/models", "/agent/models"],
  ["/config/seed", "/agent/settings/restore"],
  ["/config", "/agent/settings"],
  ["/config/:section", "/agent/settings/:section"],
];

type Redirect = { source: string; destination: string; permanent: boolean };

async function redirects(): Promise<Redirect[]> {
  const fn = nextConfig.redirects;
  if (!fn) throw new Error("next.config.ts declares no redirects()");
  return (await fn()) as Redirect[];
}

describe("old paths redirect, temporarily", () => {
  it.each(EXPECTED)("%s → %s", async (source, destination) => {
    const list = await redirects();
    const hit = list.find((r) => r.source === source);
    expect(hit).toEqual({ source, destination, permanent: false });
  });

  it("carries no permanent redirect at all", async () => {
    const permanent = (await redirects()).filter((r) => r.permanent);
    expect(permanent).toEqual([]);
  });

  it("the specific config paths are listed before the generic :section one, so they win", async () => {
    const sources = (await redirects()).map((r) => r.source);
    expect(sources.indexOf("/config/models")).toBeLessThan(sources.indexOf("/config/:section"));
    expect(sources.indexOf("/config/seed")).toBeLessThan(sources.indexOf("/config/:section"));
  });

  it("every literal destination is a route the registry owns", async () => {
    const routes = new Set(allModuleRoutes());
    const literal = (await redirects()).filter((r) => !r.destination.includes(":"));
    for (const r of literal) {
      // A destination may carry a query (the Personalities fold lands on
      // ?tab=identity); the registry owns paths, so compare the path.
      const to = r.destination.split("?")[0];
      expect({ to, owned: routes.has(to) }).toEqual({ to, owned: true });
    }
  });
});
