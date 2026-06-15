// Unit tests for `composeTemplateUrl` from `src/lib/dashboard-helpers.ts` —
// used by the dashboard's Mission Dispatch strip to build the compose URL.

import { describe, it, expect } from "@jest/globals";
import { composeTemplateUrl } from "@/lib/dashboard-helpers";

describe("composeTemplateUrl", () => {
  it("builds the canonical URL with template id and compose=1 flag", () => {
    expect(composeTemplateUrl("tpl-abc-123")).toBe(
      "/orchestration/missions?template=tpl-abc-123&compose=1",
    );
  });

  it("uses the literal template id without URL-encoding (current contract)", () => {
    expect(composeTemplateUrl("simple-id")).toBe(
      "/orchestration/missions?template=simple-id&compose=1",
    );
  });
});
