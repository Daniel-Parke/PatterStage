/**
 * Tests for DefaultsGrid left accent bars.
 * Verifies accent rendering: agent=orange, active model=purple, unset=none.
 */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");
const defaultsGridPath = join(repoRoot, "src", "components", "models", "DefaultsGrid.tsx");

describe("DefaultsGrid.tsx — left accent bars", () => {
  let content: string;

  beforeAll(() => {
    content = readFileSync(defaultsGridPath, "utf-8");
  });

  it("has relative overflow-hidden on GlowSurface for absolute positioning", () => {
    expect(content).toContain("relative overflow-hidden");
  });

  it("renders orange accent bar for agent slot", () => {
    expect(content).toContain('bg-neon-orange');
    expect(content).toContain('slot === "agent"');
  });

  it("renders purple accent bar for slots with active model", () => {
    expect(content).toContain('bg-neon-purple');
    expect(content).toContain("modelForSlot");
  });

  it("accent bars use absolute left-0 positioning", () => {
    expect(content).toContain("absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl");
  });
});
