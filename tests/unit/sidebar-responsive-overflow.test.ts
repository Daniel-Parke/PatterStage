/**
 * Tests for Sidebar responsive overflow fix.
 * Verifies that desktop and mobile aside elements have h-screen class.
 */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");
const sidebarPath = join(repoRoot, "src", "components", "layout", "Sidebar.tsx");

describe("Sidebar.tsx — responsive overflow fix", () => {
  let content: string;

  beforeAll(() => {
    content = readFileSync(sidebarPath, "utf-8");
  });

  it("desktop aside has h-screen class", () => {
    // Find the desktop aside hidden lg:flex line
    expect(content).toContain("hidden lg:flex flex-col bg-dark-900/80 border-r border-white/10 backdrop-blur-xl transition-all duration-200 h-screen");
  });

  it("mobile aside has h-screen class", () => {
    // Find the mobile aside fixed line
    expect(content).toContain("lg:hidden fixed inset-y-0 left-0 z-50 w-56 bg-dark-950 border-r border-white/10 transform transition-transform h-screen");
  });

  it("nav retains overflow-y-auto for independent scrolling", () => {
    // The nav should still have overflow-y-auto to scroll independently of the footer
    expect(content).toContain("overflow-y-auto");
  });
});
