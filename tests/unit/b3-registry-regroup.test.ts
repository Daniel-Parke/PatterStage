/** @jest-environment node */
/**
 * B3 (T-0097), decisions 8, 11, 12 and 14: the registry regrouped into five
 * verb-first sections with an order, the URLs renamed to match, the config
 * tree off the rail, and the registry as the one source of every page's name.
 *
 *   Home      Dashboard · Quests · Help          (no heading in the rail)
 *   Work      Chat · Missions · Composer · Research · Scripts
 *   Results   Sessions · Artifacts · Insights · Logs
 *   Agent     Agents · Skills · Tools · Memory · Models · Settings
 *   Rec Room  Story Weaver
 *
 * Module ids and MODULE_ACCENTS do not move (tests/unit/module-registry.test.ts
 * and lockbook-tokens.test.ts pin them); only sections, labels and hrefs do.
 */
import { CONFIG_SECTIONS } from "@/lib/config-schema";
import { SETTINGS_GROUPS, SETTINGS_TOOLS, settingsRoutes } from "@/lib/config-sections";
import { MODULES, allModuleRoutes, getModule, labelFor } from "@/lib/modules/registry";
import { NAV_SECTIONS, moduleRoutes } from "@/lib/modules/types";
import { mainSections } from "@/components/layout/sidebar-config";

const OLD_PREFIXES = ["/orchestration", "/laboratory", "/operations", "/config", "/sessions", "/logs", "/memory", "/insights"];

describe("the five sections, in order", () => {
  it("names them once, in the order the rail shows them", () => {
    expect([...NAV_SECTIONS]).toEqual(["Home", "Work", "Results", "Agent", "Rec Room"]);
  });

  it("every module section is one of the five, and every link carries an order", () => {
    for (const mod of MODULES) {
      for (const section of mod.nav ?? []) {
        expect(NAV_SECTIONS).toContain(section.label);
        for (const link of section.links) {
          expect({ href: link.href, order: typeof link.order }).toEqual({ href: link.href, order: "number" });
        }
      }
    }
  });

  it("orders are unique within a section across modules, so the merge is deterministic", () => {
    const seen = new Map<string, Set<number>>();
    for (const mod of MODULES) {
      for (const section of mod.nav ?? []) {
        const set = seen.get(section.label) ?? new Set<number>();
        for (const link of section.links) {
          expect({ section: section.label, order: link.order, dup: set.has(link.order) }).toEqual({ section: section.label, order: link.order, dup: false });
          set.add(link.order);
        }
        seen.set(section.label, set);
      }
    }
  });

  it("the rail derives the merged sections in that order, with the links in theirs", () => {
    expect(mainSections.map((s) => s.label)).toEqual(["Home", "Work", "Results", "Agent", "Rec Room"]);
    const hrefs = (label: string) => mainSections.find((s) => s.label === label)!.links.map((l) => l.href);
    expect(hrefs("Home")).toEqual(["/", "/quests", "/help"]);
    expect(hrefs("Work")).toEqual(["/work/chat", "/work/missions", "/work/composer", "/work/research", "/work/scripts"]);
    expect(hrefs("Results")).toEqual(["/results/sessions", "/results/artifacts", "/results/insights", "/results/logs"]);
    // Personalities IS the Agents card's Identity tab now (decision 11,
    // T-0103), which is why there is no seventh row here.
    expect(hrefs("Agent")).toEqual([
      "/agent/profiles",
      "/agent/skills",
      "/agent/tools",
      "/agent/memory",
      "/agent/models",
      "/agent/settings",
    ]);
    const agents = mainSections.find((s) => s.label === "Agent")!.links.find((l) => l.href === "/agent/profiles")!;
    expect(agents.subLinks ?? []).toEqual([]);
    expect(hrefs("Rec Room")).toEqual(["/recroom/story-weaver"]);
  });

  it("the labels are the words the rail shows and the pages are titled with", () => {
    const labels = new Map(mainSections.flatMap((s) => s.links).map((l) => [l.href, l.label]));
    expect(labels.get("/work/research")).toBe("Research");
    expect(labels.get("/agent/profiles")).toBe("Agents");
    expect(labels.get("/agent/settings")).toBe("Settings");
    expect(labels.get("/quests")).toBe("Quests");
    expect(labels.get("/help")).toBe("Help");
    expect(labels.get("/results/sessions")).toBe("Sessions");
  });

  it("the Composer flag survives the regroup", () => {
    const composer = mainSections.flatMap((s) => s.links).find((l) => l.href === "/work/composer");
    expect(composer?.featureFlag).toBe("composer");
  });
});

describe("the old addresses are gone from the registry", () => {
  it("no route starts with an old prefix", () => {
    const offenders = allModuleRoutes().filter((r) => OLD_PREFIXES.some((p) => r === p || r.startsWith(p + "/")));
    expect(offenders).toEqual([]);
  });

  it("the config tree is no longer rail data", () => {
    const hermes = getModule("hermes") as unknown as Record<string, unknown>;
    expect(hermes.configPinned).toBeUndefined();
    expect(hermes.configGroups).toBeUndefined();
  });
});

describe("Settings is one route family the registry derives from the section catalogue", () => {
  it("config-sections.ts lists every CONFIG_SECTIONS id exactly once, and nothing else (D79)", () => {
    const listed = SETTINGS_GROUPS.flatMap((g) => g.sectionIds);
    expect([...listed].sort()).toEqual(Object.keys(CONFIG_SECTIONS).sort());
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("the three tool cards point at Models, Restore and System", () => {
    expect(SETTINGS_TOOLS.map((t) => t.href).sort()).toEqual(["/agent/models", "/agent/settings/restore", "/agent/settings/system"].sort());
  });

  it("every settings route is a registry route, so the e2e matrix still visits each section", () => {
    const routes = new Set(allModuleRoutes());
    for (const r of settingsRoutes()) expect({ r, present: routes.has(r) }).toEqual({ r, present: true });
    for (const id of Object.keys(CONFIG_SECTIONS)) expect(routes.has(`/agent/settings/${id}`)).toBe(true);
    expect(routes.has("/agent/settings/restore")).toBe(true);
    expect(routes.has("/agent/settings/system")).toBe(true);
  });

  it("still produces no duplicate route", () => {
    const all = [...MODULES.flatMap(moduleRoutes), ...settingsRoutes()];
    const dupes = all.filter((r, i) => all.indexOf(r) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });
});

describe("labelFor: the one source of a page's name", () => {
  it.each([
    ["/", "Dashboard"],
    ["/work/missions", "Missions"],
    ["/work/missions?template=x", "Missions"],
    ["/results/sessions/abc-123", "Sessions"],
    ["/agent/settings", "Settings"],
    ["/agent/settings/agent", "Settings"],
    ["/agent/settings/restore", "Restore"],
    ["/agent/settings/system", "System"],
    ["/agent/models", "Models"],
    ["/recroom/story-weaver/create", "Create"],
    ["/recroom/story-weaver", "Story Weaver"],
    ["/quests", "Quests"],
    ["/help", "Help"],
  ])("%s → %s", (path, label) => {
    expect(labelFor(path)).toBe(label);
  });

  it("answers null for a path no module owns, rather than guessing", () => {
    expect(labelFor("/nope")).toBeNull();
    expect(labelFor("/api/missions")).toBeNull();
  });
});
