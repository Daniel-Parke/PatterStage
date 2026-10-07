// ══════════════════════════════════════════════════════════════════════════════
// sidebar-config Models link test
// ─────────────────────────────────────────────────────────────────────────────
// Models is its own page, not a config section: it was pinned above the config
// tree in PR 37, and since the regroup (T-0097) it is an Agent entry at
// /agent/models. The legacy /config/model path must not reappear anywhere.
// ══════════════════════════════════════════════════════════════════════════════

import { mainSections } from "@/components/layout/sidebar-config";
import { APP_NAV_ROUTES } from "../e2e/app-routes";

describe("sidebar-config Models link", () => {
  const allLinks = mainSections.flatMap((s) => s.links);

  it("does not include the legacy /config/model link anywhere", () => {
    expect(allLinks.some((l) => l.href === "/config/model")).toBe(false);
    expect(allLinks.some((l) => l.href === "/config/models")).toBe(false);
    expect(allLinks.some((l) => l.label === "Model")).toBe(false);
  });

  it("includes a Models link in the Agent section pointing at /agent/models", () => {
    const agent = mainSections.find((s) => s.label === "Agent");
    const link = agent?.links.find((l) => l.href === "/agent/models");
    expect(link).toBeDefined();
    expect(link!.label).toBe("Models");
    expect(link!.color).toBe("purple");
  });

  it("e2e nav matrix tracks /agent/models, not the legacy paths", () => {
    expect(APP_NAV_ROUTES).toContain("/agent/models");
    expect(APP_NAV_ROUTES).not.toContain("/config/model");
    expect(APP_NAV_ROUTES).not.toContain("/config/models");
  });
});
