import { existsSync, readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");
const manifestPath = join(repoRoot, "data/seed/profiles/manifest.json");
const packPath = join(
  repoRoot,
  "data/seed/template-packs/patterstage-professional-v1.json",
);

describe("shipped professional catalog (data/seed)", () => {
  it("includes profile manifest and template pack in the repo", () => {
    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(packPath)).toBe(true);
  });

  it("manifest lists the professional profiles plus the benchmarking baseline", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      profiles: Array<{ slug: string; seedKey: string }>;
    };
    expect(manifest.profiles).toHaveLength(7);
    const slugs = manifest.profiles.map((p) => p.slug).sort();
    expect(slugs).toEqual([
      "baseline",
      "creative-lead",
      "data-scientist",
      "devops",
      "qa",
      "support",
      "swe",
    ]);
    for (const p of manifest.profiles) {
      const soul = join(repoRoot, "data/seed/profiles", p.slug, "SOUL.md");
      const agents = join(repoRoot, "data/seed/profiles", p.slug, "AGENTS.md");
      const config = join(repoRoot, "data/seed/profiles", p.slug, "config.yaml");
      expect(existsSync(soul)).toBe(true);
      expect(existsSync(agents)).toBe(true);
      expect(existsSync(config)).toBe(true);
      const yaml = readFileSync(config, "utf-8");
      expect(yaml).toContain("platform_toolsets:");
      // The professional profiles ship Hermes toolsets; the Baseline is
      // intentionally brain-only (empty toolsets) — exclude it from that check.
      if (p.slug !== "baseline") {
        expect(yaml).toMatch(/hermes-cli|hermes-discord|hermes-telegram/);
      }
    }
  });

  it("template pack has at least ten templates with composer fields", () => {
    const pack = JSON.parse(readFileSync(packPath, "utf-8")) as {
      templates: Array<{ outputFormat: string; constraints: string }>;
    };
    expect(pack.templates.length).toBeGreaterThanOrEqual(10);
    for (const t of pack.templates) {
      expect(t.outputFormat.length).toBeGreaterThan(0);
      expect(t.constraints.length).toBeGreaterThan(0);
    }
  });
});
