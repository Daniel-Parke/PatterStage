/** @jest-environment node */
/**
 * U11 (T-0125), decision 7: every section URL answers 307 to its anchor on
 * the one page, and the registry stops counting the 27 editors as routes.
 *
 * 307, never 308, for the reason next.config.ts gives: a permanent redirect
 * outlives the URL it points at, and this repository has shipped one into a
 * 404 before. And one hop: the typo resolver, which used to answer a section
 * PAGE, answers the anchor directly, so `/agent/settings/agent-settings` is
 * one replace rather than a replace and then a redirect.
 */
import nextConfig from "../../next.config";
import { resolveSectionRedirect } from "@/lib/config-schema";
import { settingsSectionIds } from "@/lib/config-sections";
import { allModuleRoutes, documentedRoutes, labelFor } from "@/lib/modules/registry";

type Redirect = { source: string; destination: string; permanent: boolean };

async function redirects(): Promise<Redirect[]> {
  const fn = nextConfig.redirects;
  if (!fn) throw new Error("next.config.ts declares no redirects()");
  return (await fn()) as Redirect[];
}

describe("the 27 section URLs", () => {
  it.each(settingsSectionIds())("/agent/settings/%s answers 307 to its anchor", async (id) => {
    const hit = (await redirects()).find((r) => r.source === `/agent/settings/${id}`);
    expect(hit).toEqual({ source: `/agent/settings/${id}`, destination: `/agent/settings#${id}`, permanent: false });
  });

  it("neither Restore nor System is redirected: they are pages, not sections", async () => {
    const sources = (await redirects()).map((r) => r.source);
    expect(sources).not.toContain("/agent/settings/restore");
    expect(sources).not.toContain("/agent/settings/system");
    expect(sources).not.toContain("/agent/settings/:section");
  });
});

describe("the registry", () => {
  it("no longer names a section as a route", () => {
    const routes = allModuleRoutes();
    for (const id of settingsSectionIds()) expect(routes).not.toContain(`/agent/settings/${id}`);
    expect(routes).toContain("/agent/settings");
    expect(routes).toContain("/agent/settings/restore");
    expect(routes).toContain("/agent/settings/system");
  });

  it("the documented set is unchanged: one guide, Settings, stands for the page and its two children", () => {
    const documented = documentedRoutes();
    expect(documented).toContain("/agent/settings");
    // Restore and System are sections of the Settings guide, as they were.
    expect(documented).not.toContain("/agent/settings/restore");
    expect(documented).not.toContain("/agent/settings/system");
    expect(documented.filter((r) => r.startsWith("/agent/settings"))).toHaveLength(1);
  });

  it("a section path still reads as Settings, so a redirect in flight titles itself right", () => {
    expect(labelFor("/agent/settings/agent")).toBe("Settings");
    expect(labelFor("/agent/settings/restore")).toBe("Restore");
  });
});

describe("the typo resolver answers the anchor", () => {
  it("kebab-case, the label, and a unique prefix all land on #<id>", () => {
    expect(resolveSectionRedirect("session-reset")).toBe("/agent/settings#session_reset");
    expect(resolveSectionRedirect("agent-settings")).toBe("/agent/settings#agent");
    expect(resolveSectionRedirect("compr")).toBe("/agent/settings#compression");
  });

  it("a real section id is not redirected, and the model alias still goes to Models", () => {
    expect(resolveSectionRedirect("agent")).toBeNull();
    expect(resolveSectionRedirect("model")).toBe("/agent/models");
  });
});
