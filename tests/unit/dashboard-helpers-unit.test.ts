// Unit tests for `composeTemplateUrl`, which lives beside its only caller in
// `src/components/dashboard/DispatchStrip.tsx` — the dashboard's Mission
// Dispatch strip, which uses it to build the compose URL.

import { describe, it, expect } from "@jest/globals";
import { composeTemplateUrl } from "@/components/dashboard/DispatchStrip";

describe("composeTemplateUrl", () => {
  it("builds the canonical URL with template id and compose=1 flag", () => {
    expect(composeTemplateUrl("tpl-abc-123")).toBe(
      "/work/missions?template=tpl-abc-123&compose=1",
    );
  });

  it("uses the literal template id without URL-encoding (current contract)", () => {
    expect(composeTemplateUrl("simple-id")).toBe(
      "/work/missions?template=simple-id&compose=1",
    );
  });
});
