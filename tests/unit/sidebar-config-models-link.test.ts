// ══════════════════════════════════════════════════════════════════════════════
// sidebar-config Models link test
// ─────────────────────────────────────────────────────────────────────────────
// Models link moved from configGroups.Core → configSettingsPinnedLinks in PR 37
// so that it appears at the top of the Config Settings section (above HERMES.md).
// ══════════════════════════════════════════════════════════════════════════════

import { configSettingsPinnedLinks, configGroups } from "@/components/layout/sidebar-config";
import { APP_NAV_ROUTES } from "../e2e/app-routes";

describe("sidebar-config Models link", () => {
  it("does not include the legacy /config/model link anywhere", () => {
    const allLinks = [
      ...configSettingsPinnedLinks,
      ...configGroups.flatMap((g) => g.links),
    ];
    expect(allLinks.some((l) => l.href === "/config/model")).toBe(false);
    expect(allLinks.some((l) => l.label === "Model")).toBe(false);
  });

  it("includes a Models link in configSettingsPinnedLinks pointing at /config/models", () => {
    const link = configSettingsPinnedLinks.find((l) => l.href === "/config/models");
    expect(link).toBeDefined();
    expect(link!.label).toBe("Models");
    expect(link!.color).toBe("purple");
  });

  it("e2e nav matrix tracks /config/models, not the legacy path", () => {
    expect(APP_NAV_ROUTES).toContain("/config/models");
    expect(APP_NAV_ROUTES).not.toContain("/config/model");
  });
});
