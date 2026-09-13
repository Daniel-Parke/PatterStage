// ══════════════════════════════════════════════════════════════════════════════
// sidebar-config feature-flag tagging
// ─────────────────────────────────────────────────────────────────────────────
// The Composer link is gated by the `composer` flag, so the sidebar can hide it
// when PS_COMPOSER=0. Guards the tag against accidental removal.
// ══════════════════════════════════════════════════════════════════════════════

import { mainSections } from "@/components/layout/sidebar-config";

describe("sidebar-config feature-flag tags", () => {
  const allLinks = mainSections.flatMap((s) => s.links);

  it("tags the Composer link with featureFlag: 'composer'", () => {
    const composer = allLinks.find((l) => l.href === "/work/composer");
    expect(composer).toBeDefined();
    expect(composer!.featureFlag).toBe("composer");
  });

  it("leaves always-on links untagged", () => {
    const missions = allLinks.find((l) => l.href === "/work/missions");
    expect(missions).toBeDefined();
    expect(missions!.featureFlag).toBeUndefined();
  });
});
