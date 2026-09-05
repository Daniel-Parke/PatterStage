/** @jest-environment node */
/**
 * The module registry is the single source of navigation (ADR-0005).
 *
 * Before it, `sidebar-config.ts` was a hardcoded array that had to be mirrored
 * by hand into `tests/e2e/app-routes.ts`, and the mirror had drifted:
 * /laboratory/artifacts existed as a page and in the sidebar but was absent from
 * the route matrix, so the navigation tests silently stopped covering it.
 *
 * The last test here closes that class of bug: every top-level page in the app
 * must be reachable from the registry, or be listed as a deliberate exception.
 */
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

import { MODULES, allModuleRoutes, getModule } from "@/lib/modules/registry";
import { moduleRoutes } from "@/lib/modules/types";

describe("module registry", () => {
  it("registers core, hermes, laboratory and rec-room", () => {
    expect(MODULES.map((m) => m.id)).toEqual(["core", "hermes", "laboratory", "rec-room"]);
    expect(getModule("rec-room")?.title).toBe("Rec Room");
    expect(getModule("nope")).toBeUndefined();
  });

  it("has unique module ids", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces no duplicate routes across modules", () => {
    const all = MODULES.flatMap(moduleRoutes);
    const seen = new Map<string, number>();
    for (const r of all) seen.set(r, (seen.get(r) ?? 0) + 1);
    expect([...seen.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });

  it("gives every route an absolute path", () => {
    for (const route of allModuleRoutes()) {
      expect(route.startsWith("/")).toBe(true);
    }
  });

  it("includes sub-links, not just their parent", () => {
    const routes = allModuleRoutes();
    expect(routes).toContain("/recroom/story-weaver");
    expect(routes).toContain("/recroom/story-weaver/characters");
    expect(routes).toContain("/recroom/story-weaver/themes");
  });

  it("carries the composer feature flag through to the derived nav", () => {
    const core = getModule("core")!;
    const composer = core.nav!
      .flatMap((s) => s.links)
      .find((l) => l.href === "/work/composer");
    expect(composer?.featureFlag).toBe("composer");
  });

  // The regression that motivated the registry.
  it("covers /laboratory/artifacts", () => {
    expect(allModuleRoutes()).toContain("/results/artifacts");
  });
});

describe("every page is reachable from the registry", () => {
  /**
   * Pages that legitimately have no nav entry: dynamic detail routes reached by
   * clicking a row, and the config index which the sidebar renders itself.
   */
  // Nothing is exempt any more: the Settings index is a registry route since
  // the regroup (T-0097), so every static page has a rail entry.
  const EXEMPT = new Set<string>([]);

  function pageRoutes(dir: string, prefix = ""): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // Dynamic segments are detail views, not nav destinations.
        if (entry.startsWith("[") || entry.startsWith("(")) {
          // An OPTIONAL catch-all serves its own parent prefix as well as
          // everything under it: src/app/help/[[...slug]]/page.tsx IS the page
          // for /help, and a sibling src/app/help/page.tsx beside it would be a
          // route conflict the build refuses (B16). Counting it keeps this
          // guard's teeth; exempting /help would have blunted them.
          if (entry.startsWith("[[...") && existsSync(join(full, "page.tsx"))) {
            out.push(prefix === "" ? "/" : prefix);
          }
          const nested = entry.startsWith("(") ? prefix : null;
          if (nested !== null) out.push(...pageRoutes(full, nested));
          continue;
        }
        out.push(...pageRoutes(full, `${prefix}/${entry}`));
      } else if (entry === "page.tsx") {
        out.push(prefix === "" ? "/" : prefix);
      }
    }
    return out;
  }

  it("finds the pages to check, so an empty walk cannot read as a pass", () => {
    // `missing` is empty when the walk finds nothing, which is the same green
    // as a registry that covers everything (T-0066, closed in T-0075).
    // Measured at 27 page.tsx files.
    expect(pageRoutes(join(process.cwd(), "src", "app")).length).toBeGreaterThanOrEqual(20);
  });

  it("has a registry entry for every non-dynamic page", () => {
    const pages = pageRoutes(join(process.cwd(), "src", "app"));
    const routes = new Set(allModuleRoutes());
    const missing = pages.filter((p) => !routes.has(p) && !EXEMPT.has(p));
    expect(missing).toEqual([]);
  });

  it("has a page for every registry route", () => {
    const pages = new Set(pageRoutes(join(process.cwd(), "src", "app")));
    // /config/<section> is one dynamic page serving many sections.
    const orphans = allModuleRoutes().filter(
      (r) => !pages.has(r) && !r.startsWith("/agent/settings/"),
    );
    expect(orphans).toEqual([]);
  });
});
